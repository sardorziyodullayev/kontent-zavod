// Ma'lumot modeli: seed (namunaviy ma'lumot), vaqt o'tishi (tick) va statistika.
import { CHECKLIST, DAY, HOUR, PLATFORMS, SCRIPT_TEMPLATES, TOPICS, pname } from './constants';
import { at, dayStart, localDow, localHour } from './format';
import type { Format, GrowthModel, Platform, PlatformId, Post, Script, Stage, State, Stats, Video } from './types';

// ---------- deterministik tasodif ----------
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const gauss = (x: number, mu: number, s: number) => Math.exp(-((x - mu) ** 2) / (2 * s * s));
type Rng = () => number;

// ---------- platforma modellari (simulyatsiya uchun) ----------
interface PlatformModel { short: number; long: number; tauShort: number; tauLong?: number; subs: number; peak: number; peak2: number; organic: number; dow: number[] }
const MODEL: Record<PlatformId, PlatformModel> = {
  youtube: { short: 5200, long: 12500, tauShort: 30, tauLong: 110, subs: 0.011, peak: 19, peak2: 13, organic: 22, dow: [0.95, 0.95, 1, 1, 1.05, 1.15, 1.2] },
  instagram: { short: 8200, long: 0, tauShort: 20, subs: 0.006, peak: 20, peak2: 12, organic: 15, dow: [1, 1, 1.05, 1, 1.1, 1.15, 1.05] },
  tiktok: { short: 14500, long: 0, tauShort: 14, subs: 0.008, peak: 21, peak2: 17, organic: 30, dow: [0.95, 0.95, 1, 1, 1.15, 1.25, 1.2] },
  telegram: { short: 3100, long: 4200, tauShort: 9, tauLong: 12, subs: 0.004, peak: 9, peak2: 20, organic: 6, dow: [1.1, 1.05, 1.05, 1.05, 1, 0.85, 0.85] },
  facebook: { short: 2300, long: 0, tauShort: 26, subs: 0.003, peak: 13, peak2: 20, organic: 4, dow: [1, 1, 1, 1, 1, 0.95, 0.9] },
};
export const supportsLong = (pid: PlatformId) => MODEL[pid].long > 0;
const TOPIC_FACTOR: Record<string, number> = { 'AI vositalari': 1.45, 'Biznes uchun AI': 1.1, 'AI yangiliklar': 1.0, Darslik: 0.9, 'AI bilan daromad': 1.2, Avtomatlashtirish: 1.25 };
const hourFactor = (pid: PlatformId, h: number) => {
  const m = MODEL[pid];
  return 0.5 + 0.75 * Math.max(gauss(h, m.peak, 2.3), gauss(h + 24, m.peak, 2.3)) + 0.3 * gauss(h, m.peak2, 1.8);
};

function makeModel(rng: Rng, pid: PlatformId, video: Video, publishedAt: number, trend: number): GrowthModel {
  const m = MODEL[pid];
  const long = video.format === 'long' && m.long > 0;
  const n = Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng());
  let V = (long ? m.long : m.short) * hourFactor(pid, localHour(publishedAt)) * m.dow[localDow(publishedAt)] * (TOPIC_FACTOR[video.topic] ?? 1) * trend * Math.exp(0.5 * n);
  if (video.viral) V *= 6.5;
  const ret = long ? 0.28 + rng() * 0.2 : 0.38 + rng() * 0.42;
  return {
    V: Math.round(V),
    tau: long ? m.tauLong! : m.tauShort * (0.8 + rng() * 0.5),
    like: 0.03 + rng() * 0.05 + (ret - 0.4) * 0.03,
    comment: 0.002 + rng() * 0.008,
    share: 0.003 + rng() * 0.015 * (video.topic === 'Avtomatlashtirish' ? 2 : 1),
    save: 0.004 + rng() * 0.02 * (video.topic === 'Darslik' || video.topic === 'AI vositalari' ? 1.6 : 1),
    subs: m.subs * (0.6 + rng() * 0.8) * (long ? 1.8 : 1),
    ret,
    ctr: pid === 'youtube' ? 0.03 + rng() * 0.07 : null,
  };
}

// ---------- seed ----------
const TITLES: Record<string, string[]> = {
  'AI vositalari': ['ChatGPT bilan 5 daqiqada biznes-reja', 'Bu AI sizning ishingizni bajaradi', 'Sun’iy intellekt 10 soniyada logo chizdi', 'Telefoningizdagi yashirin AI funksiyalar', 'AI bilan ovozni klon qilish: xavfli tomoni', 'Prezentatsiyani AI 1 daqiqada tayyorladi', 'Eng foydali 5 ta bepul AI sayt', 'AI rezyume yozdi — HR nima dedi?', 'Midjourney va bepul muqobillari', 'AI bilan inglizcha gapirishni mashq qilish', 'Claude bilan kod yozish: 0 dan bot'],
  'Biznes uchun AI': ['Do‘koningizga AI sotuvchi', 'AI bilan reklama video 0 so‘mga', 'Restoran uchun AI menyu', 'Kichik biznesga 3 ta AI vosita', 'AI bilan raqobatchini tahlil qilish', 'Mijoz yo‘qotishni AI to‘xtatadi', 'AI bilan narx belgilash', 'Biznes-reja 5 daqiqada'],
  'AI yangiliklar': ['Bu hafta AI’da nima bo‘ldi', 'Yangi ChatGPT: nima o‘zgardi', 'Google’ning yangi AI’si sinovda', 'AI video generatorlar taqqosi', 'Claude yangi versiyasi: test', 'AI telefonlar: kerakmi?', 'Bu AI bepul bo‘ldi', 'O‘zbek tilini tushunadigan AI’lar'],
  Darslik: ['Python’ni 30 kunda o‘rganish rejasi', 'Telefonda kino sifatida video olish', 'Montajda 3 ta tezkor hiyla', 'Video uchun ssenariy yozish formulasi', 'Mobilografiya: yorug‘lik sirlari', 'Excel’da 1 daqiqada hisobot', 'CapCut’da subtitr avtomatik', 'Kanalni 0 dan 10K gacha olib chiqish'],
  'AI bilan daromad': ['AI bilan frilansda birinchi 100$', 'ChatGPT bilan matn yozib pul topish', 'AI rasm sotish: real tajriba', 'Kanal uchun AI ovoz: daromad hisobi', 'AI xizmatini qanchaga sotish kerak', 'Bir kunlik AI frilanser ish kuni', 'AI bilan qo‘shimcha daromadning 5 yo‘li', 'Mijozni qayerdan topish mumkin'],
  'Avtomatlashtirish': ['Do‘kon uchun buyurtma boti 1 kunda', 'Excel’dagi ishni AI bajaradi', 'Telegram kanal o‘zi post joylaydi', 'Mijoz savollariga AI javob beradi', 'Hisobotni avtomatik yuborish', 'CRM’siz mijozlar bazasi', 'Instagram izohlariga avtomatik javob', 'Bir tugma bilan 10 ta post'],
};
export const HASHTAGS: Record<string, string> = { 'AI vositalari': '#ai #suniyintellekt #chatgpt #pixelmind', 'Biznes uchun AI': '#biznes #ai #tadbirkor #uzbekistan', 'AI yangiliklar': '#ainews #texnologiya #yangiliklar #pixelmind', Darslik: '#darslik #ai #amaliy #pixelmind', 'AI bilan daromad': '#daromad #ai #frilans #pul', 'Avtomatlashtirish': '#avtomatlashtirish #telegrambot #ai #biznes' };
export const emptyScript = (topic = ''): Script => ({ template: '', hook: '', body: '', cta: '', hashtags: HASHTAGS[topic] ?? '', description: '' });
export const emptyChecklist = () => Object.fromEntries(CHECKLIST.map((c) => [c.id, false])) as Video['checklist'];

function scriptFor(title: string, topic: string, rng: Rng): Script {
  const t = SCRIPT_TEMPLATES[Math.floor(rng() * SCRIPT_TEMPLATES.length)];
  return { template: t.id, hook: `${title}? Birinchi 3 soniyada javob.`, body: t.body.replaceAll('…', topic.toLowerCase() + ' haqida'), cta: t.cta, hashtags: HASHTAGS[topic] ?? '', description: `${title}. To‘liq ma’lumot tavsifda.` };
}

export function seed(now = Date.now()): State {
  const rng = mulberry32(20261020);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
  const today = dayStart(now);
  const start = today - 90 * DAY;
  const used: Record<string, number> = {};
  const titleFor = (topic: string) => {
    const list = TITLES[topic];
    const i = (used[topic] = (used[topic] ?? 0) + 1) - 1;
    return list[i % list.length] + (i >= list.length ? ` (${Math.floor(i / list.length) + 1}-qism)` : '');
  };
  const videos: Video[] = [];
  let vid = 1, pidn = 1;
  const newVideo = (o: { status: Stage; createdAt: number; topic?: string; title?: string; format?: Format; viral?: boolean }) => {
    const topic = o.topic ?? pick(TOPICS);
    const title = o.title ?? titleFor(topic);
    const format = o.format ?? 'short';
    const v: Video = {
      id: 'v' + vid++, title, topic, format, duration: format === 'long' ? 480 + Math.floor(rng() * 600) : 25 + Math.floor(rng() * 40),
      status: o.status, createdAt: o.createdAt, owner: pick(['Sardor', 'Madina', 'Jasur']),
      checklist: emptyChecklist(), script: scriptFor(title, topic, rng), notes: '', posts: [], viral: !!o.viral,
    };
    videos.push(v);
    return v;
  };

  // 90 kunlik tarix
  const hours = [8, 9, 12, 13, 17, 18, 19, 20, 21, 22];
  for (let d = 0; d < 90; d++) {
    const day = start + d * DAY;
    const count = rng() < 0.18 ? 0 : rng() < 0.75 ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const format: Format = rng() < 0.15 ? 'long' : 'short';
      const v = newVideo({ status: 'published', format, createdAt: day - (3 + Math.floor(rng() * 6)) * DAY, viral: d === 61 && k === 0 });
      CHECKLIST.forEach((c) => (v.checklist[c.id] = true));
      const plats: PlatformId[] = format === 'long'
        ? ['youtube', 'telegram']
        : ['tiktok', ...(rng() < 0.9 ? ['instagram' as const] : []), ...(rng() < 0.8 ? ['youtube' as const] : []), ...(rng() < 0.4 ? ['facebook' as const] : []), ...(rng() < 0.3 ? ['telegram' as const] : [])];
      const baseH = pick(hours);
      const trend = 0.72 + 0.55 * (d / 90);
      for (const p of plats) {
        let t = at(day, Math.min(23, baseH + Math.floor(rng() * 3) - (p === 'telegram' ? 1 : 0)), pick([0, 0, 15, 30, 45]));
        if (t > now - HOUR) t = now - HOUR - Math.floor(rng() * 4) * HOUR;
        v.posts.push({ id: 'p' + pidn++, platform: p, scheduledAt: t, publishedAt: t, status: 'published', url: `https://example.com/${p}/${v.id}`, model: makeModel(rng, p, v, t, trend), snapshots: [] });
      }
    }
  }
  // bitta muvaffaqiyatsiz yuklash
  const failedVideo = videos.filter((v) => v.format === 'short').at(-3);
  if (failedVideo) {
    failedVideo.posts.push({ id: 'p' + pidn++, platform: 'facebook', scheduledAt: failedVideo.posts[0].publishedAt!, publishedAt: null, status: 'failed', error: 'API xatosi 401: kirish tokeni eskirgan', model: null, snapshots: [] });
  }

  // kelajak: rejalashtirilgan videolar
  const plan: { title: string; d: number; h: number; plats: PlatformId[]; done: number; topic: string; format?: Format }[] = [
    { title: 'Claude bilan 1 kunda sayt yasadim', d: 0, h: 20, plats: ['tiktok', 'instagram', 'youtube'], done: 8, topic: 'AI vositalari' },
    { title: 'Oyiga 1000$: kichik biznes hisob-kitobi', d: 1, h: 19, plats: ['tiktok', 'instagram'], done: 8, topic: 'Biznes uchun AI' },
    { title: 'Haftalik texno-dayjest #42', d: 1, h: 9, plats: ['telegram'], done: 6, topic: 'AI yangiliklar' },
    { title: 'Ota-onam AI ishlatsa', d: 2, h: 21, plats: ['tiktok', 'youtube', 'facebook'], done: 5, topic: 'Avtomatlashtirish' },
    { title: 'CapCut to‘liq kurs: 1-dars', d: 3, h: 18, plats: ['youtube', 'telegram'], done: 4, topic: 'Darslik', format: 'long' },
    { title: 'Ovozingizni AI bilan 5 tilga tarjima qiling', d: 4, h: 20, plats: ['tiktok', 'instagram'], done: 3, topic: 'AI vositalari' },
    { title: 'Bir yil har kuni video joyladim — natija', d: 6, h: 21, plats: ['tiktok', 'instagram', 'youtube'], done: 2, topic: 'AI bilan daromad' },
    { title: 'Telegram do‘kon: 0 dan birinchi savdogacha', d: 8, h: 19, plats: ['tiktok', 'instagram'], done: 1, topic: 'Biznes uchun AI' },
    { title: 'Eng yaxshi budjet smartfon 2026', d: 10, h: 20, plats: ['tiktok', 'youtube'], done: 1, topic: 'AI yangiliklar' },
  ];
  for (const p of plan) {
    let t = at(today + p.d * DAY, p.h);
    if (t <= now + 2 * HOUR) t = at(today + (p.d + 1) * DAY, p.h);
    const status: Stage = p.done === 8 ? 'scheduled' : p.done >= 5 ? 'editing' : p.done >= 3 ? 'production' : 'script';
    const v = newVideo({ status, title: p.title, topic: p.topic, format: p.format, createdAt: now - (2 + Math.floor(rng() * 5)) * DAY });
    CHECKLIST.slice(0, p.done).forEach((c) => (v.checklist[c.id] = true));
    for (const pl of p.plats) v.posts.push({ id: 'p' + pidn++, platform: pl, scheduledAt: t + (pl === 'telegram' ? -HOUR : 0), publishedAt: null, status: 'scheduled', model: null, snapshots: [] });
  }
  // g'oyalar va ssenariylar (sanasiz)
  const ideaTitles = ['AI bilan podkast montaj qilish', 'Toshkentdagi eng arzon coworking', '1 daqiqada Notion sozlash', 'Kontent zavod: jamoa qanday ishlaydi', 'Reels uchun 7 ta kuchli hook', 'Freelancer soliqlari 2026', 'Robot changyutgich: 3 oylik test', 'AI bilan kod review', 'YouTube monetizatsiya O‘zbekistonda', 'Ertalab 5:00 da turish tajribasi', 'Kursdoshim startap ochdi', 'Shahar bo‘ylab 24 soat'];
  let ii = 0;
  const groups: [Stage, number][] = [['idea', 6], ['script', 3], ['production', 1], ['editing', 1], ['ready', 1]];
  const doneBy: Partial<Record<Stage, number>> = { idea: 0, script: 1, production: 3, editing: 4, ready: 8 };
  for (const [status, n] of groups) {
    for (let i = 0; i < n; i++) {
      const v = newVideo({ status, title: ideaTitles[ii++], createdAt: now - Math.floor(rng() * 10) * DAY });
      CHECKLIST.slice(0, doneBy[status]).forEach((c) => (v.checklist[c.id] = true));
      if (status === 'idea') v.script = emptyScript(v.topic);
    }
  }

  const platforms: Platform[] = ([
    { id: 'youtube', handle: '@kontentzavod', base: 31800, connected: true, tokenExpiresAt: now + 40 * DAY },
    { id: 'instagram', handle: '@kontentzavod', base: 19600, connected: true, tokenExpiresAt: now + 3 * DAY + 5 * HOUR },
    { id: 'tiktok', handle: '@kontentzavod', base: 42300, connected: true, tokenExpiresAt: now + 25 * DAY },
    { id: 'telegram', handle: 't.me/kontentzavod', base: 9100, connected: true, tokenExpiresAt: null },
    { id: 'facebook', handle: 'fb.com/kontentzavod', base: 6700, connected: false, tokenExpiresAt: now - 2 * DAY },
  ] as const).map((p) => ({ ...p, organicPerDay: MODEL[p.id].organic, since: start }));

  const state: State = {
    version: 1, seededAt: now, nextId: { v: vid, p: pidn },
    workspace: { name: 'PixelMind', timezone: 'Asia/Tashkent', autoPublish: true },
    goals: { monthlySubs: 9000, monthlyViews: 2500000, weeklyVideos: 7 },
    platforms, videos, activity: [],
  };
  log(state, now - 3 * HOUR, 'publish', 'Avtomatik joylash: oxirgi video TikTok va Instagram’ga chiqdi');
  log(state, now - 5 * HOUR, 'script', 'Madina 2 ta yangi ssenariy qo‘shdi');
  log(state, now - 26 * HOUR, 'warning', 'Facebook tokeni eskirdi — yuklash to‘xtadi');
  log(state, now - 30 * HOUR, 'milestone', 'TikTok 100 000 obunachiga yaqinlashmoqda');
  return tick(state, now);
}

/** Haqiqiy ish uchun toza holat: namunaviy video, soxta obunachi va maqsadlarsiz, simulyatsiya o'chirilgan.
 *  `from` berilsa uning nomi va id hisoblagichi saqlanadi (eski id'lar takrorlanmasin), `keep` videolari o'tkaziladi. */
export function emptyState(now = Date.now(), from?: State, keep: Video[] = []): State {
  const platforms: Platform[] = PLATFORMS.map(({ id }) => ({ id, handle: '', base: 0, connected: false, tokenExpiresAt: null, organicPerDay: 0, since: now, manualDelta: 0 }));
  const state: State = {
    version: 1, seededAt: now, nextId: from?.nextId ?? { v: 1, p: 1 },
    workspace: { name: from?.workspace.name ?? 'PixelMind', timezone: 'Asia/Tashkent', autoPublish: false },
    goals: { monthlySubs: 1000, monthlyViews: 100000, weeklyVideos: 3 },
    platforms, videos: structuredClone(keep), activity: [],
  };
  log(state, now, 'milestone', 'Panel haqiqiy ishga tayyorlandi: namunaviy ma’lumotlar tozalandi');
  return state;
}

export function log(state: State, t: number, type: string, text: string) {
  state.activity.unshift({ t, type, text });
  state.activity = state.activity.slice(0, 200);
}

// ---------- vaqt o'tishi ----------
export const readiness = (v: Video) => CHECKLIST.filter((c) => v.checklist[c.id]).length / CHECKLIST.length;

/** Vaqti kelgan postlarni joylaydi (simulyatsiya yoqilgan bo'lsa) yoki o'tkazib yuborilgan deb belgilaydi. */
export function tick(state: State, now = Date.now()): State {
  for (const v of state.videos) {
    for (const p of v.posts) {
      if (p.status !== 'scheduled' || p.scheduledAt > now || !state.workspace.autoPublish) continue;
      if (readiness(v) >= 1) {
        const rng = mulberry32(hashStr(p.id + v.id));
        p.status = 'published';
        p.publishedAt = p.scheduledAt;
        p.url = p.url || `https://example.com/${p.platform}/${v.id}`;
        p.model = makeModel(rng, p.platform, v, p.publishedAt, 1.3);
        log(state, p.publishedAt, 'publish', `“${v.title}” ${pname(p.platform)}’ga avtomatik joylandi`);
      } else {
        p.status = 'missed';
        p.error = `Vaqtida tayyor bo‘lmadi (${Math.round(readiness(v) * 100)}%)`;
        log(state, p.scheduledAt, 'warning', `“${v.title}” ${pname(p.platform)} uchun o‘tkazib yuborildi — tayyor emas`);
      }
    }
    if (v.posts.some((p) => p.status === 'published') && v.posts.every((p) => p.status !== 'scheduled')) v.status = 'published';
  }
  state.updatedAt = now;
  return state;
}

// ---------- statistika ----------
const EMPTY: Stats = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, subs: 0, retention: 0, ctr: null };

export function postStats(p: Post, t: number): Stats {
  if (p.status !== 'published' || !p.publishedAt || t < p.publishedAt) return EMPTY;
  if (p.snapshots.length) {
    let last: Post['snapshots'][number] | undefined;
    for (const s of p.snapshots) if (s.t <= t && (!last || s.t >= last.t)) last = s;
    return last ? { ...EMPTY, ...last } : EMPTY;
  }
  const m = p.model;
  if (!m) return EMPTY;
  const age = (t - p.publishedAt) / HOUR;
  const views = Math.round(m.V * (1 - Math.exp(-age / m.tau)));
  return { views, likes: Math.round(views * m.like), comments: Math.round(views * m.comment), shares: Math.round(views * m.share), saves: Math.round(views * m.save), subs: Math.round(views * m.subs), retention: m.ret, ctr: m.ctr };
}

export interface VideoTotals extends Stats { er: number }
export function videoStats(posts: Post[], t: number): VideoTotals {
  const tot = { ...EMPTY, er: 0 };
  let retW = 0;
  for (const p of posts) {
    const s = postStats(p, t);
    tot.views += s.views; tot.likes += s.likes; tot.comments += s.comments; tot.shares += s.shares; tot.saves += s.saves; tot.subs += s.subs;
    retW += s.retention * s.views;
  }
  tot.retention = tot.views ? retW / tot.views : 0;
  tot.er = tot.views ? (tot.likes + tot.comments + tot.shares + tot.saves) / tot.views : 0;
  return tot;
}

export const allPosts = (state: State) => state.videos.flatMap((v) => v.posts.map((p) => ({ v, p })));
export const firstPublish = (v: Video) => Math.min(...v.posts.filter((p) => p.publishedAt).map((p) => p.publishedAt!), Infinity);
export const engagement = (s: Stats) => s.likes + s.comments + s.shares + s.saves;

export function followersAt(state: State, pid: PlatformId, t: number) {
  const pl = state.platforms.find((p) => p.id === pid);
  if (!pl) return 0;
  let f = pl.base + pl.organicPerDay * Math.max(0, (t - pl.since) / DAY);
  for (const v of state.videos) for (const p of v.posts) if (p.platform === pid) f += postStats(p, t).subs;
  return Math.round(f + (pl.manualDelta ?? 0));
}

export const platformMeta = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)!;
