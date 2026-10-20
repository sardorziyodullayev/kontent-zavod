// Analitika: kunlik qatorlar, KPI, eng yaxshi vaqt, prognoz, ogohlantirishlar, tavsiyalar.
import { CHECKLIST, DAY, DOW_NAMES, HOUR, PLATFORMS, PLATFORM_IDS, SLOTS, TOPICS, pname } from './constants';
import { dayStart, fmtDate, fmtDur, fmtNum, fmtTime, localDow, localHour, slotLabel, slotOf } from './format';
import { allPosts, engagement, postStats, readiness, supportsLong } from './model';
import type { Alert, Forecast, Insight, PlatformId, Post, QueueItem, State, Stats, Video } from './types';

type Metric = 'views' | 'subs' | 'likes';
export interface DayRow { day: number; values: Record<PlatformId, number> }

export function dailySeries(state: State, from: number, to: number, metric: Metric = 'views', platforms: PlatformId[] = PLATFORM_IDS): DayRow[] {
  const days: DayRow[] = [];
  for (let d = dayStart(from); d <= to; d += DAY) days.push({ day: d, values: Object.fromEntries(platforms.map((p) => [p, 0])) as DayRow['values'] });
  for (const { p } of allPosts(state)) {
    if (!platforms.includes(p.platform) || p.status !== 'published' || !p.publishedAt || p.publishedAt > to) continue;
    for (const row of days) {
      const end = Math.min(row.day + DAY, to);
      if (end < p.publishedAt) continue;
      row.values[p.platform] += postStats(p, end)[metric] - postStats(p, row.day)[metric];
    }
  }
  if (metric === 'subs') {
    for (const row of days) for (const pid of platforms) {
      const pl = state.platforms.find((x) => x.id === pid);
      if (pl) row.values[pid] += (pl.organicPerDay * (Math.min(row.day + DAY, to) - row.day)) / DAY;
    }
  }
  for (const row of days) for (const k of platforms) row.values[k] = Math.round(row.values[k]);
  return days;
}
export const rowTotal = (r: DayRow) => Object.values(r.values).reduce((a, b) => a + b, 0);
const sumRows = (rows: DayRow[]) => rows.reduce((s, r) => s + rowTotal(r), 0);

export interface PeriodKpi { views: number; subs: number; posts: number; er: number }
export function kpis(state: State, now: number, days: number, platforms: PlatformId[] = PLATFORM_IDS) {
  const calc = (from: number, to: number): PeriodKpi => {
    let posts = 0, eng = 0, vw = 0;
    for (const { p } of allPosts(state)) {
      if (!platforms.includes(p.platform) || p.status !== 'published' || !p.publishedAt) continue;
      if (p.publishedAt >= from && p.publishedAt < to) {
        posts++;
        const s = postStats(p, to);
        eng += engagement(s);
        vw += s.views;
      }
    }
    return { views: sumRows(dailySeries(state, from, to, 'views', platforms)), subs: sumRows(dailySeries(state, from, to, 'subs', platforms)), posts, er: vw ? eng / vw : 0 };
  };
  return { cur: calc(now - days * DAY, now), prev: calc(now - 2 * days * DAY, now - days * DAY) };
}

// ---------- vaqt slotlari va prognoz ----------
interface Row { v: Video; p: Post; s: Stats }
function matured(state: State, now: number, filter: (v: Video, p: Post) => boolean): Row[] {
  return allPosts(state)
    .filter(({ v, p }) => p.status === 'published' && p.publishedAt && now - p.publishedAt > 3 * DAY && filter(v, p))
    .map(({ v, p }) => ({ v, p, s: postStats(p, now) }));
}
export const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const quant = (a: number[], q: number) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

export function slotMatrix(state: State, now: number, platforms: PlatformId[] = PLATFORM_IDS) {
  const cells = Array.from({ length: 7 }, () => SLOTS.map(() => ({ sum: 0, n: 0 })));
  const rows = matured(state, now, (_v, p) => platforms.includes(p.platform));
  const med: Partial<Record<PlatformId, number>> = {};
  for (const pid of platforms) med[pid] = median(rows.filter((r) => r.p.platform === pid).map((r) => r.s.views)) || 1;
  for (const r of rows) {
    const c = cells[localDow(r.p.publishedAt!)][slotOf(localHour(r.p.publishedAt!))];
    c.sum += r.s.views / med[r.p.platform]!;
    c.n++;
  }
  return cells.map((row) => row.map((c) => (c.n ? { idx: c.sum / c.n, n: c.n } : null)));
}

function factor(rows: Row[], key: (r: Row) => boolean, base: number) {
  const g = rows.filter(key);
  if (!g.length || !base) return 1;
  const raw = median(g.map((r) => r.s.views)) / base;
  return (g.length * raw + 3) / (g.length + 3); // kichik guruhlar 1 ga yaqinlashadi
}

export function forecast(state: State, now: number, video: Pick<Video, 'format' | 'topic'>, platform: PlatformId, when: number): Forecast | null {
  const rows = matured(state, now, (v, p) => p.platform === platform && (v.format === video.format || !supportsLong(platform)));
  const all = rows.length ? rows : matured(state, now, (_v, p) => p.platform === platform);
  if (!all.length) return null;
  const recent = all.filter((r) => now - r.p.publishedAt! < 45 * DAY);
  const pool = recent.length >= 5 ? recent : all;
  const views = pool.map((r) => r.s.views);
  const base = median(views);
  const allMed = median(all.map((r) => r.s.views));
  const fh = factor(all, (r) => slotOf(localHour(r.p.publishedAt!)) === slotOf(localHour(when)), allMed);
  const fd = factor(all, (r) => localDow(r.p.publishedAt!) === localDow(when), allMed);
  const ft = factor(all, (r) => r.v.topic === video.topic, allMed);
  const subsRate = median(pool.map((r) => (r.s.views ? r.s.subs / r.s.views : 0)));
  const erRate = median(pool.map((r) => (r.s.views ? engagement(r.s) / r.s.views : 0)));
  const mid = base * fh * fd * ft;
  const lo = (quant(views, 0.25) / (base || 1)) * mid, hi = (quant(views, 0.8) / (base || 1)) * mid;
  const n = pool.length;
  return {
    mid: Math.round(mid), lo: Math.round(lo), hi: Math.round(hi),
    subs: Math.round(mid * subsRate), subsLo: Math.round(lo * subsRate), subsHi: Math.round(hi * subsRate),
    er: erRate, n, confidence: n >= 20 ? 'yuqori' : n >= 8 ? 'o‘rta' : 'past', factors: { soat: fh, kun: fd, mavzu: ft },
  };
}
export const forecastPost = (state: State, now: number, v: Video, p: Post) => forecast(state, now, v, p.platform, p.scheduledAt);

export function bestSlots(state: State, now: number, platform: PlatformId, count = 3) {
  const rows = matured(state, now, (_v, p) => p.platform === platform);
  if (!rows.length) return [];
  const med = median(rows.map((r) => r.s.views)) || 1;
  const out: { slot: number; idx: number; n: number }[] = [];
  for (let s = 0; s < SLOTS.length; s++) {
    const g = rows.filter((r) => slotOf(localHour(r.p.publishedAt!)) === s);
    if (g.length >= 3) out.push({ slot: s, idx: median(g.map((r) => r.s.views)) / med, n: g.length });
  }
  return out.sort((a, b) => b.idx - a.idx).slice(0, count);
}

export function bestDay(state: State, now: number, platform: PlatformId) {
  const rows = matured(state, now, (_v, p) => p.platform === platform);
  const med = median(rows.map((r) => r.s.views)) || 1;
  const out: { dow: number; idx: number; n: number }[] = [];
  for (let d = 0; d < 7; d++) {
    const g = rows.filter((r) => localDow(r.p.publishedAt!) === d);
    if (g.length >= 3) out.push({ dow: d, idx: median(g.map((r) => r.s.views)) / med, n: g.length });
  }
  return out.sort((a, b) => b.idx - a.idx)[0] ?? null;
}

// ---------- ogohlantirishlar ----------
export function alerts(state: State, now: number): Alert[] {
  const out: Alert[] = [];
  const medianByPlatform: Partial<Record<PlatformId, number>> = {};
  const medFor = (pid: PlatformId) => (medianByPlatform[pid] ??= median(matured(state, now, (_v, p) => p.platform === pid).map((r) => r.s.views)));
  for (const v of state.videos) {
    const r = readiness(v);
    const next = v.posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
    if (next && r < 1) {
      const h = (next.scheduledAt - now) / HOUR;
      if (h < 72) out.push({ level: h < 24 ? 'critical' : 'serious', videoId: v.id, title: `“${v.title}” tayyor emas`, text: `${Math.round(r * 100)}% tayyor, joylashga ${fmtDur(next.scheduledAt - now)} qoldi. Yetishmaydi: ${CHECKLIST.filter((c) => !v.checklist[c.id]).map((c) => c.name.toLowerCase()).join(', ')}.`, t: next.scheduledAt });
    }
    for (const p of v.posts) {
      if (p.status === 'failed' || p.status === 'missed') out.push({ level: 'critical', videoId: v.id, postId: p.id, title: `${pname(p.platform)}: joylanmadi`, text: `“${v.title}” — ${p.error ?? 'noma’lum xato'}`, t: p.scheduledAt, action: 'retry' });
      if (p.status === 'published' && p.publishedAt && now - p.publishedAt < 3 * DAY) {
        const s = postStats(p, now);
        const med = medFor(p.platform);
        const expected = med * (1 - Math.exp(-((now - p.publishedAt) / HOUR) / (p.model?.tau ?? 24)));
        if (med && s.views > expected * 2.5 && s.views > 5000) out.push({ level: 'good', videoId: v.id, title: `${pname(p.platform)}da trendga chiqmoqda`, text: `“${v.title}” — ${fmtNum(s.views)} ko‘rish, odatdagidan ${(s.views / expected).toFixed(1)}× ko‘p. Davomini tezroq tayyorlang.`, t: p.publishedAt });
      }
    }
  }
  for (const pl of state.platforms) {
    if (!pl.connected) out.push({ level: 'critical', platformId: pl.id, title: `${pname(pl.id)} ulanmagan`, text: 'Token eskirgan yoki ulanish uzilgan. Platformalar bo‘limida qayta ulang.', t: pl.tokenExpiresAt ?? now });
    else if (pl.tokenExpiresAt && pl.tokenExpiresAt - now < 7 * DAY) out.push({ level: 'warning', platformId: pl.id, title: `${pname(pl.id)} tokeni tugayapti`, text: `${fmtDur(pl.tokenExpiresAt - now)} ichida yangilang, aks holda avtomatik joylash to‘xtaydi.`, t: pl.tokenExpiresAt });
  }
  const empty: number[] = [];
  for (let d = 1; d <= 7; d++) {
    const ds = dayStart(now) + d * DAY;
    if (!allPosts(state).some(({ p }) => p.status === 'scheduled' && p.scheduledAt >= ds && p.scheduledAt < ds + DAY)) empty.push(ds);
  }
  if (empty.length) out.push({ level: 'warning', title: `Keyingi 7 kunda ${empty.length} ta bo‘sh kun`, text: `${empty.map((d) => fmtDate(d)).join(', ')} — hech narsa rejalashtirilmagan. Haftalik maqsad: ${state.goals.weeklyVideos} video.`, t: empty[0], action: 'plan' });
  const order = { critical: 0, serious: 1, warning: 2, good: 3 };
  const goods = out.filter((a) => a.level === 'good').sort((a, b) => b.t - a.t).slice(0, 2);
  return out.filter((a) => a.level !== 'good').concat(goods).sort((a, b) => order[a.level] - order[b.level] || a.t - b.t);
}

// ---------- tavsiyalar ----------
export function insights(state: State, now: number): Insight[] {
  const out: Insight[] = [];
  const rows = matured(state, now, () => true);
  if (rows.length < 5) return out;
  for (const pl of PLATFORMS) {
    const b = bestSlots(state, now, pl.id, 1)[0];
    const d = bestDay(state, now, pl.id);
    if (b && b.idx > 1.1) out.push({ kind: 'time', platform: pl.id, text: `${pl.name}: eng yaxshi vaqt — ${slotLabel(b.slot)}, bu oraliqda videolar medianadan ${Math.round((b.idx - 1) * 100)}% ko‘p ko‘riladi (${b.n} ta post).${d && d.idx > 1.05 ? ` Eng kuchli kun — ${DOW_NAMES[d.dow].toLowerCase()}.` : ''}` });
  }
  const byTopic = TOPICS.map((t) => {
    const g = rows.filter((r) => r.v.topic === t);
    const views = g.reduce((s, r) => s + r.s.views, 0);
    return { t, n: g.length, med: median(g.map((r) => r.s.views)), subs1k: views ? (g.reduce((s, r) => s + r.s.subs, 0) / views) * 1000 : 0 };
  }).filter((x) => x.n >= 3).sort((a, b) => b.med - a.med);
  if (byTopic.length >= 2) {
    const top = byTopic[0], low = byTopic[byTopic.length - 1];
    out.push({ kind: 'topic', text: `“${top.t}” mavzusi eng kuchli: median ${fmtNum(top.med)} ko‘rish. “${low.t}” esa ${Math.round((1 - low.med / top.med) * 100)}% past — formatini o‘zgartiring yoki kamroq qiling.` });
    const bySubs = [...byTopic].sort((a, b) => b.subs1k - a.subs1k)[0];
    out.push({ kind: 'subs', text: `Obunachi olib keladigan mavzu: “${bySubs.t}” — har 1000 ko‘rishga ${bySubs.subs1k.toFixed(1)} obunachi.` });
  }
  const rate = (g: Row[]) => { const v = g.reduce((s, r) => s + r.s.views, 0); return v ? (g.reduce((s, r) => s + r.s.subs, 0) / v) * 1000 : 0; };
  const short = rows.filter((r) => r.v.format === 'short' && r.p.platform === 'youtube');
  const long = rows.filter((r) => r.v.format === 'long' && r.p.platform === 'youtube');
  if (short.length >= 3 && long.length >= 3) out.push({ kind: 'format', text: `YouTube’da uzun videolar har 1000 ko‘rishga ${rate(long).toFixed(1)} obunachi beradi, Shorts esa ${rate(short).toFixed(1)}. Haftasiga kamida 1 ta uzun video qo‘ying.` });
  const weak = rows.filter((r) => r.v.format === 'short' && r.s.retention < 0.45 && now - r.p.publishedAt! < 30 * DAY);
  if (weak.length) out.push({ kind: 'hook', text: `Oxirgi 30 kunda ${new Set(weak.map((r) => r.v.id)).size} ta qisqa videoda tomosha 45% dan past. Birinchi 2 soniyadagi “hook”ni kuchaytiring: savol yoki natijani boshida ko‘rsating.` });
  const k = kpis(state, now, 7);
  if (k.cur.posts < state.goals.weeklyVideos) out.push({ kind: 'cadence', text: `Bu hafta ${k.cur.posts} ta joylash bo‘ldi, maqsad ${state.goals.weeklyVideos}. Muntazamlik algoritm uchun muhim — bo‘sh kunlarni to‘ldiring.` });
  return out;
}

// ---------- navbat va eksport ----------
export function nextQueue(state: State, now: number): QueueItem[] {
  return allPosts(state)
    .filter(({ p }) => p.status === 'scheduled')
    .sort((a, b) => a.p.scheduledAt - b.p.scheduledAt)
    .map(({ v, p }) => ({
      postId: p.id, videoId: v.id, title: v.title, platform: p.platform, scheduledAt: p.scheduledAt, ready: readiness(v) >= 1, readiness: readiness(v),
      caption: [v.script.description, v.script.hashtags].filter(Boolean).join('\n\n'), dueIn: p.scheduledAt - now,
    }));
}

export function toCSV(state: State, now: number) {
  const head = ['video_id', 'sarlavha', 'mavzu', 'format', 'platforma', 'holat', 'joylangan_sana', 'joylangan_vaqt', 'korishlar', 'layklar', 'izohlar', 'ulashishlar', 'saqlashlar', 'yangi_obunachilar', 'tomosha_foizi', 'url'];
  const rows = allPosts(state).map(({ v, p }) => {
    const s = postStats(p, now);
    const t = p.publishedAt ?? p.scheduledAt;
    return [v.id, v.title, v.topic, v.format, pname(p.platform), p.status, t ? fmtDate(t, { year: true }) : '', t ? fmtTime(t) : '', s.views, s.likes, s.comments, s.shares, s.saves, s.subs, s.retention ? (s.retention * 100).toFixed(1) : '', p.url ?? ''];
  });
  return [head, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
}
