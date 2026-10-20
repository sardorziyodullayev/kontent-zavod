// Kontent Zavod — admin panel interfeysi.
import * as C from './core.js';
import { lineChart, sparkline, showTip, hideTip } from './charts.js';

const { DAY, HOUR, fmtNum, fmtFull, fmtDate, fmtTime, pct, pname } = C;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (s, r = document) => r.querySelector(s);
const PC = (id) => `var(--s-${id})`;
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const LS_STATE = 'kz-state-v1', LS_THEME = 'kz-theme', LS_TOKEN = 'kz-token';

// ---------- ikonlar ----------
const IC = {
  logo: 'M3 20V10l5 3v-3l5 3V6l8 4v10z', home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  film: 'M4 4h16v16H4z M8 4v16 M16 4v16 M4 9h4 M4 15h4 M16 9h4 M16 15h4', calendar: 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5',
  pen: 'M4 20h4L19 9l-4-4L4 16z M14 6l4 4', chart: 'M4 20V4 M4 20h16 M8 16v-5 M12 16V8 M16 16v-3', plug: 'M9 7V3 M15 7V3 M7 7h10v4a5 5 0 0 1-10 0z M12 16v5',
  flow: 'M4 6h6v4H4z M14 14h6v4h-6z M7 10v4a2 2 0 0 0 2 2h5', gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  plus: 'M12 5v14 M5 12h14', search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4', sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z', check: 'M5 12l5 5 9-10', x: 'M6 6l12 12 M18 6L6 18',
  alert: 'M12 9v4 M12 17h.01 M10.3 3.9L2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', up: 'M7 17L17 7 M9 7h8v8',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2', menu: 'M4 7h16 M4 12h16 M4 17h16', trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  download: 'M12 4v12 M7 11l5 5 5-5 M5 20h14', upload: 'M12 20V8 M7 13l5-5 5 5 M5 4h14', play: 'M7 5l12 7-12 7z', refresh: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1', bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  spark: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5L18 18 M6 18l2.5-2.5 M15.5 8.5L18 6', chevL: 'M15 6l-6 6 6 6', chevR: 'M9 6l6 6-6 6', arrow: 'M5 12h14 M13 6l6 6-6 6',
};
const ico = (n, s = 18) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IC[n]}"/></svg>`;

// ---------- ma'lumot qatlami ----------
const store = { mode: 'demo', S: null };
const now = () => Date.now();

async function load() {
  try {
    const r = await fetch('api/state', { cache: 'no-store' });
    if (!r.ok) throw new Error();
    const j = await r.json();
    if (j.mode !== 'server') throw new Error();
    store.mode = 'server'; store.S = j.state;
  } catch {
    store.mode = 'demo';
    let S = null;
    try { S = JSON.parse(ls.get(LS_STATE)); } catch {}
    if (!S || S.version !== 1 || !Array.isArray(S.videos)) S = C.seed(now());
    store.S = C.tick(S, now());
    saveLocal();
  }
}
const saveLocal = () => { if (store.mode === 'demo') ls.set(LS_STATE, JSON.stringify(store.S)); };

async function act(type, payload, msg, { silent } = {}) {
  try {
    if (store.mode === 'server') {
      const headers = { 'Content-Type': 'application/json' };
      const tok = ls.get(LS_TOKEN);
      if (tok) headers.Authorization = 'Bearer ' + tok;
      const r = await fetch('api/action', { method: 'POST', headers, body: JSON.stringify({ type, payload }) });
      if (r.status === 401) { const t = prompt('Admin token (ADMIN_TOKEN):'); if (!t) return null; ls.set(LS_TOKEN, t); return act(type, payload, msg, { silent }); }
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      store.S = j.state;
      if (msg) toast(msg);
      if (!silent) render();
      return j.result;
    }
    C.tick(store.S, now());
    const { result } = C.applyAction(store.S, { type, payload }, now());
    saveLocal();
    if (msg) toast(msg);
    if (!silent) render();
    return result;
  } catch (e) { toast(e.message || 'Xato', true); return null; }
}

// ---------- UI holati ----------
const ui = {
  route: 'dashboard', period: 30, pf: 'all', hidden: {}, heatPf: 'all', vLimit: 40,
  vf: { q: '', platform: 'all', topic: 'all', format: 'all', status: 'all' }, sort: { key: 'date', dir: -1 },
  cal: null, drawer: null, modal: null, palette: null, menu: false,
};
const pfs = () => (ui.pf === 'all' ? C.PLATFORM_IDS : [ui.pf]);
let charts = [];

const NAV = [
  { id: 'dashboard', hash: '', name: 'Boshqaruv', icon: 'home' },
  { id: 'videolar', name: 'Videolar', icon: 'film' },
  { id: 'reja', name: 'Reja va kalendar', icon: 'calendar' },
  { id: 'ssenariylar', name: 'Ssenariylar', icon: 'pen' },
  { id: 'tahlil', name: 'Tahlil', icon: 'chart' },
  { id: 'platformalar', name: 'Platformalar', icon: 'plug' },
  { id: 'konveyer', name: 'Konveyer va API', icon: 'flow' },
  { sep: true },
  { id: 'sozlamalar', name: 'Sozlamalar', icon: 'gear' },
];
const TITLES = {
  dashboard: ['Boshqaruv', 'Bugungi holat, keyingi video va natijalar'],
  videolar: ['Videolar', 'Har bir video qayerda, qachon joylandi va qanday natija berdi'],
  reja: ['Reja va kalendar', 'Qachon nima chiqadi va tayyormi'],
  ssenariylar: ['Ssenariylar', 'G‘oyadan joylashgacha ishlab chiqarish liniyasi'],
  tahlil: ['Tahlil', 'Nima ishlayapti, qachon joylash kerak'],
  platformalar: ['Platformalar', 'Ulangan akkauntlar va obunachilar'],
  konveyer: ['Konveyer va API', 'Avtomatik joylash navbati va integratsiyalar'],
  sozlamalar: ['Sozlamalar', 'Maqsadlar, ma’lumotlar va ko‘rinish'],
};

function routeFromHash() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  ui.route = TITLES[h] ? h : 'dashboard';
}

// ---------- umumiy bo'laklar ----------
const pf = (id) => `<span class="pf pf-${id}"><i></i>${pname(id)}</span>`;
const pchip = (id) => `<span class="pchip"><i class="sw-${id}"></i>${C.PLATFORMS.find((p) => p.id === id).short}</span>`;
const pchips = (ids) => `<span class="pfs">${[...new Set(ids)].map(pchip).join('')}</span>`;
const POST_STATUS = { scheduled: ['Rejada', 'accent'], published: ['Joylandi', 'good'], failed: ['Xato', 'critical'], missed: ['O‘tkazib yuborildi', 'critical'] };
const postTag = (s) => { const [n, c] = POST_STATUS[s] || [s, '']; return `<span class="tag ${c}"><span class="dot"></span>${n}</span>`; };
const STAGE_TAG = { idea: '', script: '', production: '', editing: 'warning', ready: 'accent', scheduled: 'accent', published: 'good' };
const stageTag = (s) => `<span class="tag ${STAGE_TAG[s] || ''}">${STAGE_TAG[s] ? '<span class="dot"></span>' : ''}${C.stageName(s)}</span>`;
const thumb = (v) => {
  const h = C.hashStr(v.topic) % 360;
  const d = v.format === 'long' ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}` : `0:${String(v.duration).padStart(2, '0')}`;
  return `<div class="thumb ${v.format}" style="--h:${h}"><span>${d}</span></div>`;
};
function delta(cur, prev, { invert = false, suffix = '' } = {}) {
  if (!prev) return '';
  const d = (cur - prev) / prev;
  const good = invert ? d < 0 : d >= 0;
  return `<span class="delta ${good ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(1).replace('.0', '')}%${suffix}</span>`;
}
const meter = (v, cls = '') => `<div class="meter ${cls}"><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%"></i></div>`;
const periodSeg = () => `<div class="seg" role="group" aria-label="Davr">${[7, 30, 90].map((d) => `<button data-act="period" data-v="${d}" aria-pressed="${ui.period === d}">${d} kun</button>`).join('')}</div>`;
const pfSelect = (key = 'pf', val = ui.pf) => `<select class="input" data-change="${key}" aria-label="Platforma"><option value="all">Barcha platformalar</option>${C.PLATFORMS.map((p) => `<option value="${p.id}" ${val === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}</select>`;
const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;
const dtLocal = (ms) => { const d = C.local(ms); return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) }; };
const fromLocal = (date, time) => Date.parse(`${date}T${time || '00:00'}:00Z`) - C.TZ_OFFSET;

// ---------- shell ----------
function shell(body) {
  const S = store.S, t = now();
  const crit = C.alerts(S, t).filter((a) => a.level === 'critical').length;
  const [title, sub] = TITLES[ui.route];
  return `
  <div class="app">
    <aside class="side ${ui.menu ? 'open' : ''}" aria-label="Asosiy menyu">
      <a class="brand" href="#/">
        <span class="brand-mark">${ico('logo', 18)}</span>
        <span><span class="brand-name">${esc(S.workspace.name)}</span><br><span class="brand-sub">kontent zavodi</span></span>
      </a>
      <nav class="nav">${NAV.map((n) => n.sep ? '<div class="nav-sep"></div>' : `<a href="#/${n.hash ?? n.id}" ${ui.route === n.id ? 'aria-current="page"' : ''}>${ico(n.icon)}${n.name}${n.id === 'dashboard' && crit ? `<span class="badge" title="Muhim ogohlantirishlar">${crit}</span>` : ''}</a>`).join('')}</nav>
      <div class="side-foot">
        <div class="mode-pill">${store.mode === 'server' ? `<span class="dot live"></span>Server ulangan · ${S.workspace.autoPublish ? 'simulyatsiya' : 'worker rejimi'}` : '<span class="dot demo"></span>Demo rejim · ma’lumot brauzerda'}</div>
      </div>
    </aside>
    <div class="main">
      <header class="top">
        <button class="btn icon ghost menu-btn" data-act="menu" aria-label="Menyu">${ico('menu')}</button>
        <div><h1>${title}</h1><div class="sub">${sub}</div></div>
        <div class="top-actions">
          <button class="btn search-btn" data-act="palette" aria-label="Qidirish">${ico('search', 16)}<span class="lbl">Qidirish yoki buyruq</span><span class="kbd">Ctrl K</span></button>
          <button class="btn icon ghost" data-act="theme" aria-label="Mavzuni almashtirish">${ico(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun')}</button>
          <button class="btn primary" data-act="new-video">${ico('plus', 16)}<span class="hide-m">Yangi video</span></button>
        </div>
      </header>
      <main class="page" id="page">${body}</main>
    </div>
  </div>
  ${ui.menu ? '<div class="scrim" data-act="menu" style="z-index:55"></div>' : ''}`;
}

// ---------- BOSHQARUV ----------
function nextVideo(S, t) {
  const q = C.nextQueue(S, t);
  if (!q.length) return null;
  const v = S.videos.find((x) => x.id === q[0].videoId);
  const posts = v.posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt);
  return { v, posts, at: posts[0].scheduledAt };
}
function sumForecast(S, t, v, posts) {
  const f = posts.map((p) => C.forecastPost(S, t, v, p)).filter(Boolean);
  if (!f.length) return null;
  const s = (k) => f.reduce((a, x) => a + x[k], 0);
  return { mid: s('mid'), lo: s('lo'), hi: s('hi'), subs: s('subs'), subsLo: s('subsLo'), subsHi: s('subsHi'), er: f.reduce((a, x) => a + x.er, 0) / f.length, n: Math.min(...f.map((x) => x.n)), confidence: f.some((x) => x.confidence === 'past') ? 'past' : f.some((x) => x.confidence === 'o‘rta') ? 'o‘rta' : 'yuqori', per: f.map((x, i) => ({ ...x, platform: posts[i].platform })) };
}

function heroCard(S, t) {
  const nx = nextVideo(S, t);
  if (!nx) return `<section class="card hero"><div class="eyebrow">Keyingi video</div><p class="empty">Hech narsa rejalashtirilmagan. <button class="btn sm" data-act="schedule">Rejalashtirish</button></p></section>`;
  const { v, posts, at } = nx;
  const r = C.readiness(v);
  const f = sumForecast(S, t, v, posts);
  const missing = C.CHECKLIST.filter((c) => !v.checklist[c.id]);
  return `
  <section class="card hero" aria-label="Keyingi video">
    <div class="hero-top">
      <div style="min-width:0;flex:1 1 320px">
        <div class="eyebrow">Keyingi video</div>
        <h2 class="hero-title">${esc(v.title)}</h2>
        <div class="meta">${pchips(posts.map((p) => p.platform))}<span>${esc(v.topic)}</span><span>${v.format === 'long' ? 'Uzun video' : 'Qisqa video'}</span><span>Mas’ul: ${esc(v.owner)}</span></div>
      </div>
      <div class="countdown">
        <div class="eyebrow">Joylashgacha</div>
        <div class="big" data-countdown="${at}">${cd(at - t)}</div>
        <div class="when">${C.relDay(at, t)}, ${fmtTime(at)} · Toshkent</div>
      </div>
    </div>
    <div class="conveyor">
      <div class="conveyor-h"><span><b>${Math.round(r * 100)}%</b> <span class="t2">tayyor</span></span><span class="muted" style="font-size:12.5px">${r >= 1 ? 'Hammasi tayyor — vaqtida avtomatik chiqadi' : `Yetishmaydi: ${missing.length} ta bosqich`}</span></div>
      <div class="stations">${C.CHECKLIST.map((c) => `<button class="station ${v.checklist[c.id] ? 'done' : ''}" data-act="check" data-id="${v.id}" data-key="${c.id}" data-val="${v.checklist[c.id] ? 0 : 1}" title="${esc(c.name)}" aria-pressed="${!!v.checklist[c.id]}"><span class="bar"></span><span class="lbl">${esc(c.name)}</span></button>`).join('')}</div>
    </div>
    ${f ? `<div class="forecast">
      <div><div class="k">Kutilayotgan ko‘rishlar</div><div class="v">${fmtNum(f.mid)}</div><div class="r">${fmtNum(f.lo)} – ${fmtNum(f.hi)}</div></div>
      <div><div class="k">Yangi obunachilar</div><div class="v">+${fmtNum(f.subs)}</div><div class="r">${fmtNum(f.subsLo)} – ${fmtNum(f.subsHi)}</div></div>
      <div><div class="k">Prognoz ishonchi</div><div class="v" style="text-transform:capitalize">${f.confidence}</div><div class="r">${f.n} ta o‘xshash post asosida</div></div>
    </div>` : ''}
    ${f ? `<div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Platforma</th><th>Vaqt</th><th class="r">Prognoz (ko‘rish)</th><th class="r">+Obunachi</th><th>Shu platforma uchun eng yaxshi vaqt</th></tr></thead><tbody>
      ${f.per.map((x) => { const p = posts.find((y) => y.platform === x.platform); const b = C.bestSlots(S, t, x.platform, 1)[0]; const inBest = b && C.slotOf(C.localHour(p.scheduledAt)) === b.slot; return `<tr><td>${pf(x.platform)}</td><td class="nowrap">${fmtTime(p.scheduledAt)}</td><td class="r">${fmtNum(x.lo)}–${fmtNum(x.hi)}</td><td class="r">+${fmtNum(x.subs)}</td><td class="nowrap">${b ? (inBest ? `<span class="tag good"><span class="dot"></span>${C.slotLabel(b.slot)} ✓</span>` : `<span class="tag">${C.slotLabel(b.slot)}</span>`) : '—'}</td></tr>`; }).join('')}
    </tbody></table></div>` : ''}
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
      <button class="btn sm" data-act="open" data-id="${v.id}">${ico('film', 15)}Videoni ochish</button>
      <button class="btn sm" data-act="publish-video" data-id="${v.id}">${ico('play', 15)}Hozir joylash</button>
      <a class="btn sm ghost" href="#/reja">${ico('calendar', 15)}Kalendar</a>
    </div>
  </section>`;
}
function cd(ms) {
  if (ms <= 0) return '00:00:00';
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / 60e3), s = Math.floor((ms % 60e3) / 1e3);
  const p = (x) => String(x).padStart(2, '0');
  return (d ? `${d}k ` : '') + `${p(h)}:${p(m)}:${p(s)}`;
}

const ALERT_IC = { critical: 'alert', serious: 'clock', warning: 'clock', good: 'up' };
function alertsCard(S, t, limit = 6) {
  const list = C.alerts(S, t);
  return `<section class="card"><div class="card-h"><h2>Diqqat talab</h2><span class="sub">${list.length} ta</span></div>
  <div class="alerts">${list.slice(0, limit).map((a) => `<div class="alert ${a.level}"><span class="ic">${ico(ALERT_IC[a.level], 14)}</span><div><b>${esc(a.title)}</b><p>${esc(a.text)}</p>
    <div class="acts">${a.action === 'retry' ? `<button class="btn sm" data-act="retry" data-post="${a.postId}">${ico('refresh', 14)}Qayta urinish</button>` : ''}${a.platformId ? `<button class="btn sm" data-act="reconnect" data-pf="${a.platformId}">${ico('link', 14)}${S.platforms.find((p) => p.id === a.platformId).connected ? 'Tokenni yangilash' : 'Qayta ulash'}</button>` : ''}${a.action === 'plan' ? `<button class="btn sm" data-act="schedule" data-date="${a.t}">${ico('plus', 14)}Rejalashtirish</button>` : ''}${a.videoId ? `<button class="btn sm ghost" data-act="open" data-id="${a.videoId}">Ochish</button>` : ''}</div></div></div>`).join('') || '<p class="empty">Hammasi joyida ✓</p>'}
  ${list.length > limit ? `<p class="muted" style="font-size:12.5px;margin:8px 0 0">Yana ${list.length - limit} ta — <a href="#/konveyer">konveyerda ko‘ring</a></p>` : ''}</div></section>`;
}

function kpiTiles(S, t) {
  const k = C.kpis(S, t, ui.period, pfs());
  const views = C.dailySeries(S, t - ui.period * DAY, t, 'views', pfs()).map((r) => Object.values(r.values).reduce((a, b) => a + b, 0));
  const subs = C.dailySeries(S, t - ui.period * DAY, t, 'subs', pfs()).map((r) => Object.values(r.values).reduce((a, b) => a + b, 0));
  const postsDaily = [];
  for (let d = C.dayStart(t - (ui.period - 1) * DAY); d <= t; d += DAY) postsDaily.push(C.allPosts(S).filter(({ p }) => p.status === 'published' && pfs().includes(p.platform) && p.publishedAt >= d && p.publishedAt < d + DAY).length);
  const tile = (label, value, d, spark, title) => `<section class="card stat" title="${esc(title || '')}"><div class="label">${label}</div><div class="value">${value}</div><div class="foot"><span>${d}<span class="delta"><span class="vs">&nbsp;oldingi ${ui.period} kunga</span></span></span>${spark}</div></section>`;
  return `<div class="grid g-4 mt">
    ${tile('Ko‘rishlar', fmtNum(k.cur.views), delta(k.cur.views, k.prev.views), sparkline(views), fmtFull(k.cur.views))}
    ${tile('Yangi obunachilar', '+' + fmtNum(k.cur.subs), delta(k.cur.subs, k.prev.subs), sparkline(subs), fmtFull(k.cur.subs))}
    ${tile('Joylashlar', fmtFull(k.cur.posts), delta(k.cur.posts, k.prev.posts), sparkline(postsDaily))}
    ${tile('O‘rtacha ER', pct(k.cur.er), delta(k.cur.er, k.prev.er), '<span class="muted" style="font-size:11.5px">layk+izoh+ulashish+saqlash / ko‘rish</span>')}
  </div>`;
}

function viewsChartCard(S, t, key = 'views-main', metric = 'views', title = 'Kunlik ko‘rishlar') {
  const days = C.dailySeries(S, t - (ui.period - 1) * DAY, t, metric, pfs());
  const series = pfs().map((id) => ({ id, name: pname(id), color: PC(id), values: days.map((d) => d.values[id]), hidden: ui.hidden[key + id] }));
  charts.push({ id: key, draw: (el) => lineChart(el, { labels: days.map((d) => fmtDate(d.day)), tipLabels: days.map((d) => fmtDate(d.day, { weekday: true }) + (d.day === C.dayStart(t) ? ' · bugun, davom etmoqda' : '')), series, total: true, height: 270, aria: title }) });
  return `<section class="card"><div class="card-h"><h2>${title}</h2><span class="sub">platformalar bo‘yicha, Toshkent vaqti</span></div>
    ${series.length > 1 ? `<div class="legend">${series.map((s) => `<button data-act="legend" data-k="${key + s.id}" aria-pressed="${!s.hidden}"><i style="background:${s.color}"></i>${s.name}</button>`).join('')}</div>` : ''}
    <div class="chart" id="${key}"></div></section>`;
}

function platformShareCard(S, t) {
  const rows = C.PLATFORMS.map((p) => {
    const vs = C.dailySeries(S, t - ui.period * DAY, t, 'views', [p.id]).reduce((a, r) => a + r.values[p.id], 0);
    const f = C.followersAt(S, p.id, t), f0 = C.followersAt(S, p.id, t - ui.period * DAY);
    return { ...p, views: vs, f, g: f - f0 };
  });
  const max = Math.max(...rows.map((r) => r.views), 1);
  return `<section class="card"><div class="card-h"><h2>Platformalar</h2><span class="sub">${ui.period} kunlik ko‘rishlar</span></div>
    <div class="bars">${[...rows].sort((a, b) => b.views - a.views).map((r) => `<div class="barrow" title="${r.name}: ${fmtFull(r.views)} ko‘rish"><span class="pf pf-${r.id}"><i></i>${r.name}</span><div class="track"><div class="fill" style="width:${(r.views / max) * 100}%;background:${PC(r.id)}"></div></div><span class="val">${fmtNum(r.views)}</span></div>`).join('')}</div>
    <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>Obunachilar</th><th class="r">Jami</th><th class="r">+${ui.period} kun</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td>${pf(r.id)}</td><td class="r">${fmtFull(r.f)}</td><td class="r" style="color:var(--good-text)">+${fmtNum(r.g)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function upcomingCard(S, t) {
  const groups = new Map();
  for (const { v, p } of C.allPosts(S)) {
    if (p.status !== 'scheduled' || p.scheduledAt > t + 7 * DAY) continue;
    const k = v.id + C.dayStart(p.scheduledAt);
    if (!groups.has(k)) groups.set(k, { v, at: p.scheduledAt, pfs: [] });
    const g = groups.get(k); g.pfs.push(p.platform); g.at = Math.min(g.at, p.scheduledAt);
  }
  const list = [...groups.values()].sort((a, b) => a.at - b.at);
  return `<section class="card"><div class="card-h"><h2>Yaqin 7 kun</h2><span class="sub">${list.length} ta video</span><div class="right"><button class="btn sm" data-act="schedule">${ico('plus', 14)}Rejalashtirish</button></div></div>
  <div class="list">${list.map((g) => { const r = C.readiness(g.v); return `<div class="li click" data-act="open" data-id="${g.v.id}"><div class="when"><b>${fmtTime(g.at)}</b><span>${C.relDay(g.at, t)}</span></div><div class="grow"><div class="ellipsis" style="font-weight:500">${esc(g.v.title)}</div><div style="display:flex;gap:10px;align-items:center;margin-top:5px">${pchips(g.pfs)}<div style="flex:1;max-width:120px">${meter(r, r < 1 && g.at - t < 2 * DAY ? 'crit' : r < 1 ? 'warn' : '')}</div><span class="muted" style="font-size:12px">${Math.round(r * 100)}%</span></div></div></div>`; }).join('') || '<p class="empty">Bu hafta uchun reja yo‘q</p>'}</div></section>`;
}

function recentCard(S, t) {
  const list = C.allPosts(S).filter(({ p }) => p.status === 'published').sort((a, b) => b.p.publishedAt - a.p.publishedAt).slice(0, 8);
  return `<section class="card"><div class="card-h"><h2>Oxirgi joylanganlar</h2><div class="right"><a class="btn sm ghost" href="#/videolar">Barchasi ${ico('arrow', 14)}</a></div></div>
  <div class="table-wrap"><table><thead><tr><th>Qachon</th><th>Platforma</th><th>Video</th><th class="r">Ko‘rish</th><th class="r">+Obun.</th></tr></thead><tbody>
  ${list.map(({ v, p }) => { const s = C.postStats(p, t); return `<tr class="click" data-act="open" data-id="${v.id}"><td class="nowrap">${C.relDay(p.publishedAt, t)}, ${fmtTime(p.publishedAt)}</td><td>${pchip(p.platform)}</td><td><span class="vt" style="max-width:200px">${esc(v.title)}</span></td><td class="r">${fmtNum(s.views)}</td><td class="r">+${fmtNum(s.subs)}</td></tr>`; }).join('')}
  </tbody></table></div></section>`;
}

function goalsCard(S, t) {
  const d = C.local(t);
  const mStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - C.TZ_OFFSET;
  const mEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - C.TZ_OFFSET;
  const frac = (t - mStart) / (mEnd - mStart);
  const sum = (metric) => C.dailySeries(S, mStart, t, metric).reduce((a, r) => a + Object.values(r.values).reduce((x, y) => x + y, 0), 0);
  const subs = sum('subs'), views = sum('views');
  const wStart = C.dayStart(t) - C.localDow(t) * DAY;
  const weekPosts = new Set(C.allPosts(S).filter(({ p }) => (p.status === 'published' && p.publishedAt >= wStart) || (p.status === 'scheduled' && p.scheduledAt < wStart + 7 * DAY)).map(({ v }) => v.id)).size;
  const g = (label, cur, goal, pace) => {
    const r = cur / goal;
    return `<div class="goal"><div class="row"><span>${label}</span><span><b>${fmtNum(cur)}</b> <span class="muted">/ ${fmtNum(goal)}</span></span></div>${meter(r, pace != null && pace < goal * 0.9 ? 'warn' : '')}${pace != null ? `<div class="muted" style="font-size:12px">Shu sur’atda oy oxirida: <b class="t2">${fmtNum(pace)}</b> ${pace >= goal ? '— maqsadga yetiladi' : `— ${fmtNum(goal - pace)} yetmaydi`}</div>` : ''}</div>`;
  };
  return `<section class="card"><div class="card-h"><h2>Maqsadlar</h2><span class="sub">${C.MONTHS_FULL[d.getUTCMonth()]}</span><div class="right"><a class="btn sm ghost" href="#/sozlamalar">O‘zgartirish</a></div></div>
  <div class="grid" style="gap:18px">${g('Yangi obunachilar (oy)', subs, S.goals.monthlySubs, subs / frac)}${g('Ko‘rishlar (oy)', views, S.goals.monthlyViews, views / frac)}${g('Videolar (bu hafta, reja bilan)', weekPosts, S.goals.weeklyVideos, null)}</div></section>`;
}

const ACT_IC = { publish: 'play', script: 'pen', warning: 'alert', milestone: 'up', create: 'plus', move: 'arrow', ready: 'check', schedule: 'calendar', connect: 'link', delete: 'trash' };
function activityCard(S, t, n = 8) {
  return `<section class="card"><div class="card-h"><h2>Faoliyat jurnali</h2></div>
  <div>${S.activity.slice(0, n).map((a) => `<div class="act-row"><time>${Math.abs(t - a.t) < DAY ? fmtTime(a.t) : fmtDate(a.t)}</time><span>${esc(a.text)}</span></div>`).join('')}</div></section>`;
}

function pageDashboard(S, t) {
  return `
  <div class="grid g-hero">${heroCard(S, t)}${alertsCard(S, t, 4)}</div>
  <div class="filters mt" style="margin-bottom:0">${periodSeg()}${pfSelect()}</div>
  ${kpiTiles(S, t)}
  <div class="grid g-wide mt">${viewsChartCard(S, t)}${platformShareCard(S, t)}</div>
  <div class="grid g-2 mt">${upcomingCard(S, t)}${recentCard(S, t)}</div>
  <div class="grid g-2 mt">${goalsCard(S, t)}${activityCard(S, t)}</div>`;
}

// ---------- VIDEOLAR ----------
function videoRows(S, t) {
  const f = ui.vf, q = f.q.trim().toLowerCase();
  let rows = S.videos.filter((v) =>
    (!q || v.title.toLowerCase().includes(q) || v.topic.toLowerCase().includes(q)) &&
    (f.platform === 'all' || v.posts.some((p) => p.platform === f.platform)) &&
    (f.topic === 'all' || v.topic === f.topic) && (f.format === 'all' || v.format === f.format) && (f.status === 'all' || v.status === f.status),
  ).map((v) => {
    const posts = f.platform === 'all' ? v.posts : v.posts.filter((p) => p.platform === f.platform);
    const s = C.videoStats({ posts }, t);
    const pubs = posts.filter((p) => p.publishedAt).map((p) => p.publishedAt);
    const sch = posts.filter((p) => p.status === 'scheduled').map((p) => p.scheduledAt);
    const date = pubs.length ? Math.min(...pubs) : sch.length ? Math.min(...sch) : v.createdAt;
    return { v, s, date, scheduled: !pubs.length && sch.length > 0, posts };
  });
  const k = ui.sort.key, dir = ui.sort.dir;
  const val = (r) => ({ date: r.date, views: r.s.views, er: r.s.er, ret: r.s.retention, subs: r.s.subs, title: r.v.title }[k]);
  rows.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
  return rows;
}
function videosTable(S, t) {
  const rows = videoRows(S, t);
  const th = (key, label, r) => `<th class="sortable ${r ? 'r' : ''}" data-act="sort" data-k="${key}" aria-sort="${ui.sort.key === key ? (ui.sort.dir > 0 ? 'ascending' : 'descending') : 'none'}">${label}${ui.sort.key === key ? (ui.sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
  const tot = rows.reduce((a, r) => ({ views: a.views + r.s.views, subs: a.subs + r.s.subs }), { views: 0, subs: 0 });
  return `<div class="card-h"><h2>${rows.length} ta video</h2><span class="sub">${fmtFull(tot.views)} ko‘rish · +${fmtFull(tot.subs)} obunachi</span></div>
  <div class="table-wrap"><table><thead><tr>${th('title', 'Video')}<th>Platformalar</th>${th('date', 'Joylangan / reja')}${th('views', 'Ko‘rishlar', 1)}${th('er', 'ER', 1)}${th('ret', 'Tomosha %', 1)}${th('subs', '+Obunachi', 1)}<th>Holat</th></tr></thead><tbody>
  ${rows.slice(0, ui.vLimit).map((r) => `<tr class="click" data-act="open" data-id="${r.v.id}">
    <td><div class="vcell">${thumb(r.v)}<div style="min-width:0"><span class="vt">${esc(r.v.title)}</span><span class="vs">${esc(r.v.topic)} · ${r.v.format === 'long' ? 'uzun' : 'qisqa'}</span></div></div></td>
    <td>${r.posts.length ? pchips(r.posts.map((p) => p.platform)) : '<span class="muted">—</span>'}</td>
    <td class="nowrap">${r.v.status === 'idea' && !r.posts.length ? '<span class="muted">—</span>' : `${fmtDate(r.date, { weekday: true })}, <b>${fmtTime(r.date)}</b>${r.scheduled ? ' <span class="muted">(reja)</span>' : ''}`}</td>
    <td class="r">${r.s.views ? fmtFull(r.s.views) : '<span class="muted">—</span>'}</td>
    <td class="r">${r.s.views ? pct(r.s.er) : '<span class="muted">—</span>'}</td>
    <td class="r">${r.s.views ? pct(r.s.retention, 0) : '<span class="muted">—</span>'}</td>
    <td class="r">${r.s.views ? '+' + fmtFull(r.s.subs) : '<span class="muted">—</span>'}</td>
    <td>${r.posts.some((p) => p.status === 'failed' || p.status === 'missed') ? postTag('failed') : stageTag(r.v.status)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Hech narsa topilmadi</td></tr>'}
  </tbody></table></div>
  ${rows.length > ui.vLimit ? `<div style="text-align:center;margin-top:14px"><button class="btn" data-act="more">Yana ${Math.min(40, rows.length - ui.vLimit)} ta ko‘rsatish</button></div>` : ''}`;
}
function pageVideos(S, t) {
  const f = ui.vf;
  return `<div class="filters">
    <input class="input grow" type="search" placeholder="Sarlavha yoki mavzu bo‘yicha qidirish…" value="${esc(f.q)}" data-input="vq" aria-label="Qidirish">
    ${pfSelect('vf.platform', f.platform)}
    <select class="input" data-change="vf.topic" aria-label="Mavzu"><option value="all">Barcha mavzular</option>${C.TOPICS.map((x) => opt(x, x, f.topic === x)).join('')}</select>
    <select class="input" data-change="vf.format" aria-label="Format"><option value="all">Barcha formatlar</option>${C.FORMATS.map((x) => opt(x.id, x.name, f.format === x.id)).join('')}</select>
    <select class="input" data-change="vf.status" aria-label="Holat"><option value="all">Barcha holatlar</option>${C.STAGES.map((x) => opt(x.id, x.name, f.status === x.id)).join('')}</select>
    <button class="btn" data-act="export-csv">${ico('download', 16)}CSV</button>
  </div>
  <section class="card" id="vtable">${videosTable(S, t)}</section>`;
}

// ---------- REJA / KALENDAR ----------
function pageCalendar(S, t) {
  if (ui.cal == null) { const d = C.local(t); ui.cal = { y: d.getUTCFullYear(), m: d.getUTCMonth() }; }
  const { y, m } = ui.cal;
  const first = Date.UTC(y, m, 1) - C.TZ_OFFSET;
  const startDow = C.localDow(first);
  const gridStart = first - startDow * DAY;
  const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cells = Math.ceil((startDow + daysInMonth) / 7) * 7;
  const byDay = new Map();
  for (const { v, p } of C.allPosts(S)) {
    const at = p.publishedAt || p.scheduledAt;
    if (!at || at < gridStart || at >= gridStart + cells * DAY) continue;
    const dk = C.dayStart(at), k = dk + v.id;
    if (!byDay.has(dk)) byDay.set(dk, new Map());
    const day = byDay.get(dk);
    if (!day.has(k)) day.set(k, { v, at, posts: [] });
    const g = day.get(k); g.posts.push(p); g.at = Math.min(g.at, at);
  }
  const today = C.dayStart(t);
  let html = C.DOW_SHORT.map((d, i) => `<div class="dh">${C.DOW_NAMES[i]}</div>`).join('');
  for (let i = 0; i < cells; i++) {
    const ds = gridStart + i * DAY;
    const dd = C.local(ds);
    const out = dd.getUTCMonth() !== m;
    const evs = [...(byDay.get(C.dayStart(ds + HOUR))?.values() || [])].sort((a, b) => a.at - b.at);
    const evHtml = evs.slice(0, 4).map((g) => {
      const bad = g.posts.some((p) => p.status === 'failed' || p.status === 'missed');
      const sch = g.posts.some((p) => p.status === 'scheduled');
      const cls = bad ? 'bad' : sch ? (C.readiness(g.v) >= 1 ? 'ok' : 'risk') : 'published';
      return `<button class="ev ${cls}" data-act="open" data-id="${g.v.id}" title="${esc(g.v.title)} — ${g.posts.map((p) => pname(p.platform)).join(', ')}"><span class="evtop"><span class="tm">${fmtTime(g.at)}</span>${[...new Set(g.posts.map((p) => p.platform))].map((p) => `<i class="sw-${p}"></i>`).join('')}</span><span class="tt">${esc(g.v.title)}</span></button>`;
    }).join('') + (evs.length > 4 ? `<span class="ev more">+${evs.length - 4} yana</span>` : '');
    html += `<div class="day ${out ? 'out' : ''} ${C.dayStart(ds + HOUR) === today ? 'today' : ''} ${!evs.length && C.dayStart(ds + HOUR) !== today ? 'empty-m' : ''}"><span class="dn">${dd.getUTCDate()}</span>${C.dayStart(ds + HOUR) >= today ? `<button class="btn sm icon ghost add" data-act="schedule" data-date="${ds + HOUR * 12}" aria-label="Shu kunga rejalashtirish">${ico('plus', 14)}</button>` : ''}${evHtml}</div>`;
  }
  const best = C.PLATFORMS.map((p) => ({ p, b: C.bestSlots(S, t, p.id, 3), d: C.bestDay(S, t, p.id) }));
  const wk = [0, 1, 2].map((w) => {
    const ws = C.dayStart(t) - C.localDow(t) * DAY + w * 7 * DAY;
    const n = new Set(C.allPosts(S).filter(({ p }) => { const a = p.publishedAt || p.scheduledAt; return a >= ws && a < ws + 7 * DAY && p.status !== 'failed' && p.status !== 'missed'; }).map(({ v }) => v.id)).size;
    return { ws, n };
  });
  return `
  <div class="grid">
    <section class="card">
      <div class="card-h">
        <button class="btn sm icon" data-act="cal" data-d="-1" aria-label="Oldingi oy">${ico('chevL', 16)}</button>
        <h2 style="min-width:130px;text-align:center">${C.MONTHS_FULL[m]} ${y}</h2>
        <button class="btn sm icon" data-act="cal" data-d="1" aria-label="Keyingi oy">${ico('chevR', 16)}</button>
        <button class="btn sm ghost" data-act="cal" data-d="0">Bugun</button>
        <div class="right"><button class="btn sm primary" data-act="schedule">${ico('plus', 14)}Rejalashtirish</button></div>
      </div>
      <div class="cal">${html}</div>
      <div class="cal-legend"><span><i style="border-color:color-mix(in srgb,var(--accent) 45%,transparent)"></i>Tayyor, rejada</span><span><i style="border-color:color-mix(in srgb,var(--warning) 60%,transparent)"></i>Rejada, tayyor emas</span><span><i style="border-color:var(--line);opacity:.6"></i>Joylangan</span><span><i style="border-color:var(--critical)"></i>Xato / o‘tkazib yuborilgan</span></div>
    </section>
  </div>
    <div class="grid g-2 mt" style="align-items:start">
      <section class="card"><div class="card-h"><h2>Haftalik reja</h2><span class="sub">maqsad: ${S.goals.weeklyVideos} video</span></div>
        <div class="grid" style="gap:14px">${wk.map((w, i) => `<div class="goal"><div class="row"><span>${i === 0 ? 'Bu hafta' : i === 1 ? 'Keyingi hafta' : fmtDate(w.ws) + ' haftasi'}</span><span><b>${w.n}</b> <span class="muted">/ ${S.goals.weeklyVideos}</span></span></div>${meter(w.n / S.goals.weeklyVideos, w.n < S.goals.weeklyVideos ? 'warn' : '')}</div>`).join('')}</div></section>
      <section class="card"><div class="card-h"><h2>Eng yaxshi vaqtlar</h2><span class="sub">tarixiy natijalar bo‘yicha</span></div>
        <div class="list">${best.map(({ p, b, d }) => `<div class="li" style="align-items:flex-start"><div style="width:96px;flex:none">${pf(p.id)}</div><div class="grow" style="display:flex;flex-wrap:wrap;gap:6px">${b.map((x) => `<span class="tag" title="${x.n} ta post, medianadan ${x.idx >= 1 ? '+' : ''}${Math.round((x.idx - 1) * 100)}%">${C.slotLabel(x.slot)} <b style="color:${x.idx >= 1 ? 'var(--good-text)' : 'var(--muted)'}">${x.idx >= 1 ? '+' : ''}${Math.round((x.idx - 1) * 100)}%</b></span>`).join('') || '<span class="muted">Ma’lumot yetarli emas</span>'}${d ? `<span class="muted" style="font-size:12px;width:100%">Eng kuchli kun: ${C.DOW_NAMES[d.dow].toLowerCase()}</span>` : ''}</div></div>`).join('')}</div></section>
    </div>
  </div>`;
}

// ---------- SSENARIYLAR (kanban) ----------
function pageScripts(S, t) {
  const cols = C.STAGES;
  const by = Object.fromEntries(cols.map((c) => [c.id, []]));
  for (const v of S.videos) (by[v.status] || by.idea).push(v);
  by.published.sort((a, b) => C.firstPublish(b) - C.firstPublish(a));
  const inWork = by.script.length + by.production.length + by.editing.length;
  const dueSoon = S.videos.filter((v) => C.readiness(v) < 1 && v.posts.some((p) => p.status === 'scheduled' && p.scheduledAt - t < 7 * DAY)).length;
  const card = (v) => {
    const r = C.readiness(v);
    const next = v.posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
    const pub = v.status === 'published' ? C.videoStats(v, t) : null;
    return `<article class="kcard" draggable="true" data-drag="${v.id}" data-act="open" data-id="${v.id}" data-sec="script">
      <div class="t">${esc(v.title)}</div>
      <div class="m"><span>${esc(v.topic)} · ${v.format === 'long' ? 'uzun' : 'qisqa'}</span><span title="Mas’ul">${esc(v.owner)}</span></div>
      ${v.status !== 'published' ? `<div style="display:flex;align-items:center;gap:8px"><div style="flex:1">${meter(r, next && r < 1 && next.scheduledAt - t < 2 * DAY ? 'crit' : r < 1 && next ? 'warn' : '')}</div><span class="muted" style="font-size:11.5px">${Math.round(r * 100)}%</span></div>` : ''}
      ${next ? `<div class="m"><span>${ico('clock', 13)}</span><span style="margin-right:auto">${C.relDay(next.scheduledAt, t)}, ${fmtTime(next.scheduledAt)}</span>${pchips(v.posts.filter((p) => p.status === 'scheduled').map((p) => p.platform))}</div>` : ''}
      ${pub ? `<div class="m"><span>${fmtNum(pub.views)} ko‘rish</span><span>+${fmtNum(pub.subs)} obunachi</span></div>` : ''}
    </article>`;
  };
  return `<div class="filters"><span class="tag">${inWork} ta video ishlab chiqarishda</span>${dueSoon ? `<span class="tag warning"><span class="dot"></span>${dueSoon} tasi 7 kun ichida chiqishi kerak, hali tayyor emas</span>` : ''}<span class="muted" style="font-size:12.5px;margin-left:auto">Kartani sudrab keyingi bosqichga o‘tkazing</span></div>
  <div class="board">${cols.map((c) => `<section class="col" data-drop="${c.id}" aria-label="${c.name}"><div class="col-h"><h3>${c.name}</h3><span class="n">${by[c.id].length}</span></div>
    ${c.id === 'idea' ? `<form class="quick-add" data-form="quick-idea"><input class="input" name="title" placeholder="Yangi g‘oya…" aria-label="Yangi g‘oya" required><button class="btn sm icon primary" aria-label="Qo‘shish">${ico('plus', 15)}</button></form>` : ''}
    ${(c.id === 'published' ? by[c.id].slice(0, 6) : by[c.id]).map(card).join('')}
    ${c.id === 'published' && by.published.length > 6 ? `<a class="btn sm ghost" href="#/videolar" style="width:100%;justify-content:center">Yana ${by.published.length - 6} ta</a>` : ''}
  </section>`).join('')}</div>`;
}

// ---------- TAHLIL ----------
function pageAnalytics(S, t) {
  const ins = C.insights(S, t);
  const IIC = { time: 'clock', topic: 'spark', subs: 'up', format: 'film', hook: 'bolt', cadence: 'calendar' };
  const posts = C.allPosts(S).filter(({ p }) => p.status === 'published' && pfs().includes(p.platform) && p.publishedAt >= t - ui.period * DAY).map(({ v, p }) => ({ v, p, s: C.postStats(p, t) }));
  // format taqqoslash
  const fmt = C.FORMATS.map((f) => {
    const g = posts.filter((x) => x.v.format === f.id);
    const views = g.reduce((a, x) => a + x.s.views, 0);
    const eng = g.reduce((a, x) => a + x.s.likes + x.s.comments + x.s.shares + x.s.saves, 0);
    return { ...f, n: g.length, avg: g.length ? views / g.length : 0, subs1k: views ? (g.reduce((a, x) => a + x.s.subs, 0) / views) * 1000 : 0, er: views ? eng / views : 0, ret: views ? g.reduce((a, x) => a + x.s.retention * x.s.views, 0) / views : 0 };
  });
  // mavzular
  const topics = C.TOPICS.map((tp) => {
    const g = posts.filter((x) => x.v.topic === tp);
    const views = g.reduce((a, x) => a + x.s.views, 0);
    return { tp, n: g.length, avg: g.length ? views / g.length : 0, subs1k: views ? (g.reduce((a, x) => a + x.s.subs, 0) / views) * 1000 : 0 };
  }).sort((a, b) => b.avg - a.avg);
  const tmax = Math.max(1, ...topics.map((x) => x.avg));
  // heatmap
  const hm = C.slotMatrix(S, t, ui.heatPf === 'all' ? C.PLATFORM_IDS : [ui.heatPf]);
  const vals = hm.flat().filter(Boolean).map((c) => c.idx);
  const hmax = Math.max(1.5, ...vals);
  const step = (x) => Math.max(1, Math.min(6, Math.round((x / hmax) * 6)));
  // obunachilar o'sishi
  const fdays = [];
  for (let d = C.dayStart(t - (ui.period - 1) * DAY); d <= t; d += DAY) fdays.push(Math.min(d + DAY, t));
  const fseries = pfs().map((id) => ({ id, name: pname(id), color: PC(id), values: fdays.map((d) => C.followersAt(S, id, d)), hidden: ui.hidden['fol' + id] }));
  charts.push({ id: 'fol-chart', draw: (el) => lineChart(el, { labels: fdays.map((d) => fmtDate(d)), series: fseries, height: 260, aria: 'Obunachilar soni' }) });
  // eng yaxshi videolar
  const top = [...posts].sort((a, b) => b.s.views - a.s.views).slice(0, 10);
  // obunachi konversiyasi
  const conv = C.PLATFORMS.filter((p) => pfs().includes(p.id)).map((p) => { const g = posts.filter((x) => x.p.platform === p.id); const vw = g.reduce((a, x) => a + x.s.views, 0); return { ...p, r: vw ? (g.reduce((a, x) => a + x.s.subs, 0) / vw) * 1000 : 0, n: g.length }; });
  const cmax = Math.max(1, ...conv.map((c) => c.r));
  return `
  <div class="filters">${periodSeg()}${pfSelect()}<span class="muted" style="font-size:12.5px">${posts.length} ta post tahlil qilindi</span></div>
  <div class="grid g-wide">
    <section class="card"><div class="card-h"><h2>Tavsiyalar</h2><span class="sub">ma’lumotlardan avtomatik</span></div>
      ${ins.map((i) => `<div class="insight"><span class="ic">${ico(IIC[i.kind] || 'spark', 15)}</span><p>${esc(i.text)}</p></div>`).join('') || '<p class="empty">Tavsiya uchun ma’lumot yetarli emas</p>'}</section>
    <div class="grid" style="align-content:start">
      ${fmt.map((f) => `<section class="card"><div class="card-h"><h2>${f.name}</h2><span class="sub">${f.n} ta post</span></div>
        <div class="mini-stats" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div><div class="k">O‘rtacha ko‘rish</div><div class="v">${fmtNum(f.avg)}</div></div><div><div class="k">Obunachi / 1000</div><div class="v">${f.subs1k.toFixed(1)}</div></div><div><div class="k">ER</div><div class="v">${pct(f.er)}</div></div><div><div class="k">Tomosha</div><div class="v">${pct(f.ret, 0)}</div></div></div></section>`).join('')}
    </div>
  </div>
  <div class="grid g-2 mt">
    <section class="card"><div class="card-h"><h2>Qachon joylash kerak</h2><span class="sub">medianaga nisbatan, 2 soatlik bloklar</span><div class="right">${pfSelect('heatPf', ui.heatPf)}</div></div>
      <div class="heat" role="table" aria-label="Kun va soat bo‘yicha natija"><span></span>${C.SLOTS.map((h) => `<span class="hh">${String(h).padStart(2, '0')}</span>`).join('')}
      ${hm.map((row, d) => `<span class="hl">${C.DOW_SHORT[d]}</span>${row.map((c, s) => c ? `<span class="cell" style="background:var(--seq-${step(c.idx)});${step(c.idx) >= 4 ? 'color:transparent' : ''}" data-tip="${C.DOW_NAMES[d]}, ${C.slotLabel(s)}|${c.idx >= 1 ? '+' : ''}${Math.round((c.idx - 1) * 100)}% medianaga nisbatan|${c.n} ta post">${c.idx.toFixed(1)}×</span>` : `<span class="cell na" data-tip="${C.DOW_NAMES[d]}, ${C.slotLabel(s)}|Hali joylanmagan|0 ta post"></span>`).join('')}`).join('')}</div>
      <div class="heat-scale"><span>past</span><span class="ramp">${[1, 2, 3, 4, 5, 6].map((i) => `<i style="background:var(--seq-${i})"></i>`).join('')}</span><span>yuqori</span><span style="margin-left:auto">Katakka olib boring — tafsilot</span></div></section>
    <section class="card"><div class="card-h"><h2>Mavzular</h2><span class="sub">o‘rtacha ko‘rish / post</span></div>
      <div class="bars">${topics.map((x) => `<div class="barrow" style="grid-template-columns:130px minmax(0,1fr) 64px" title="${x.n} ta post · ${x.subs1k.toFixed(1)} obunachi / 1000 ko‘rish"><span class="ellipsis">${esc(x.tp)}</span><div class="track"><div class="fill" style="width:${(x.avg / tmax) * 100}%;background:var(--seq-4)"></div></div><span class="val">${fmtNum(x.avg)}</span></div>`).join('')}</div>
      <div class="card-h" style="margin:22px 0 12px"><h2>Obunachiga aylanish</h2><span class="sub">har 1000 ko‘rishga yangi obunachi</span></div>
      <div class="bars">${conv.map((c) => `<div class="barrow"><span class="pf pf-${c.id}"><i></i>${c.name}</span><div class="track"><div class="fill" style="width:${(c.r / cmax) * 100}%;background:${PC(c.id)}"></div></div><span class="val">${c.r.toFixed(1)}</span></div>`).join('')}</div></section>
  </div>
  <section class="card mt"><div class="card-h"><h2>Obunachilar soni</h2><span class="sub">${ui.period} kun</span></div>
    ${fseries.length > 1 ? `<div class="legend">${fseries.map((s) => `<button data-act="legend" data-k="fol${s.id}" aria-pressed="${!s.hidden}"><i style="background:${s.color}"></i>${s.name}</button>`).join('')}</div>` : ''}<div class="chart" id="fol-chart"></div></section>
  <section class="card mt"><div class="card-h"><h2>Eng yaxshi 10 ta post</h2><span class="sub">${ui.period} kun ichida joylanganlar</span></div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Video</th><th>Platforma</th><th>Joylangan</th><th class="r">Ko‘rish</th><th class="r">ER</th><th class="r">Tomosha</th><th class="r">+Obun.</th></tr></thead><tbody>
    ${top.map((x, i) => `<tr class="click" data-act="open" data-id="${x.v.id}"><td class="muted">${i + 1}</td><td><span class="vt">${esc(x.v.title)}</span><span class="vs">${esc(x.v.topic)}</span></td><td>${pf(x.p.platform)}</td><td class="nowrap">${fmtDate(x.p.publishedAt, { weekday: true })}, ${fmtTime(x.p.publishedAt)}</td><td class="r">${fmtFull(x.s.views)}</td><td class="r">${pct((x.s.likes + x.s.comments + x.s.shares + x.s.saves) / (x.s.views || 1))}</td><td class="r">${pct(x.s.retention, 0)}</td><td class="r">+${fmtFull(x.s.subs)}</td></tr>`).join('')}
    </tbody></table></div></section>`;
}

// ---------- PLATFORMALAR ----------
function pagePlatforms(S, t) {
  return `<div class="grid g-3">${S.platforms.map((pl) => {
    const meta = C.PLATFORMS.find((p) => p.id === pl.id);
    const f = C.followersAt(S, pl.id, t), f30 = C.followersAt(S, pl.id, t - 30 * DAY);
    const posts = C.allPosts(S).filter(({ p }) => p.platform === pl.id && p.status === 'published' && p.publishedAt >= t - 30 * DAY);
    const views = posts.reduce((a, { p }) => a + C.postStats(p, t).views, 0);
    const best = C.bestSlots(S, t, pl.id, 1)[0];
    const tokenLeft = pl.tokenExpiresAt ? pl.tokenExpiresAt - t : null;
    const status = !pl.connected ? ['critical', 'Ulanmagan'] : tokenLeft != null && tokenLeft < 7 * DAY ? ['warning', `Token ${C.fmtDur(tokenLeft)}da tugaydi`] : ['good', 'Ulangan'];
    const fh = []; for (let d = 29; d >= 0; d -= 2) fh.push(C.followersAt(S, pl.id, t - d * DAY));
    return `<section class="card pcard">
      <div class="pcard-h"><span class="logo" style="background:${PC(pl.id)}">${meta.short}</span><div><b>${meta.name}</b><span>${esc(pl.handle)}</span></div><span class="tag ${status[0]}" style="margin-left:auto"><span class="dot"></span>${status[1]}</span></div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:10px"><div><div class="muted" style="font-size:12px">Obunachilar</div><div class="big">${fmtFull(f)}</div><div class="delta up">▲ +${fmtFull(f - f30)} <span class="vs">30 kunda</span></div></div>${sparkline(fh, { w: 110, h: 36, color: PC(pl.id), accent: PC(pl.id) })}</div>
      <div style="margin-top:14px">
        <div class="row"><span>Postlar (30 kun)</span><b>${posts.length}</b></div>
        <div class="row"><span>Ko‘rishlar (30 kun)</span><b>${fmtNum(views)}</b></div>
        <div class="row"><span>O‘rtacha / post</span><b>${fmtNum(posts.length ? views / posts.length : 0)}</b></div>
        <div class="row"><span>Eng yaxshi vaqt</span><b>${best ? C.slotLabel(best.slot) : '—'}</b></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">${pl.connected ? `<button class="btn sm" data-act="reconnect" data-pf="${pl.id}">${ico('refresh', 14)}Tokenni yangilash</button><button class="btn sm ghost danger" data-act="disconnect" data-pf="${pl.id}">Uzish</button>` : `<button class="btn sm primary" data-act="reconnect" data-pf="${pl.id}">${ico('link', 14)}Ulash</button>`}</div>
    </section>`;
  }).join('')}</div>
  <section class="card mt"><div class="card-h"><h2>Haqiqiy API’larga ulash</h2><span class="sub">server rejimida worker shu kalitlar bilan ishlaydi</span></div>
    <div class="table-wrap"><table><thead><tr><th>Platforma</th><th>API</th><th>Nima kerak</th><th>Statistika</th></tr></thead><tbody>
      <tr><td>${pf('youtube')}</td><td>YouTube Data API v3</td><td>Google Cloud loyiha, OAuth client, <code>youtube.upload</code> ruxsati</td><td>YouTube Analytics API</td></tr>
      <tr><td>${pf('instagram')}</td><td>Instagram Graph API</td><td>Business/Creator akkaunt, Facebook sahifaga bog‘langan, Meta ilova</td><td><code>/insights</code> endpoint</td></tr>
      <tr><td>${pf('tiktok')}</td><td>TikTok Content Posting API</td><td>TikTok for Developers ilova, audit (ommaviy joylash uchun)</td><td>Display API / Research</td></tr>
      <tr><td>${pf('telegram')}</td><td>Telegram Bot API</td><td>@BotFather token, botni kanalga admin qilish</td><td>ko‘rishlar soni (post views)</td></tr>
      <tr><td>${pf('facebook')}</td><td>Facebook Graph API</td><td>Sahifa tokeni, <code>pages_manage_posts</code></td><td>Page Insights</td></tr>
    </tbody></table></div>
    <p class="muted" style="font-size:12.5px;margin:12px 0 0">Kalitlarni <code>.env</code> faylga yozing (namunasi: <code>.env.example</code>). Panel kalitlarni hech qachon brauzerga yubormaydi.</p></section>`;
}

// ---------- KONVEYER va API ----------
function pageFactory(S, t) {
  const counts = C.STAGES.map((s) => ({ ...s, n: S.videos.filter((v) => v.status === s.id).length }));
  const q = C.nextQueue(S, t).slice(0, 15);
  const base = store.mode === 'server' ? location.origin + location.pathname.replace(/\/$/, '') : 'http://localhost:4310';
  const ep = (m, path, d) => `<div class="endpoint"><span class="method ${m === 'POST' ? 'post' : ''}">${m}</span><div><code>${path}</code><div class="muted" style="margin-top:3px">${d}</div></div></div>`;
  return `
  <section class="card"><div class="card-h"><h2>Ishlab chiqarish liniyasi</h2><span class="sub">har bosqichdagi videolar soni</span></div>
    <div style="display:flex;align-items:stretch;gap:6px;overflow-x:auto;padding-bottom:4px">${counts.map((c, i) => `<a href="#/ssenariylar" style="flex:1 0 108px;text-decoration:none;background:var(--surface-2);border:1px solid var(--line);border-radius:11px;padding:12px"><div class="muted" style="font-size:12px">${i + 1}. ${c.name}</div><div style="font-size:26px;font-weight:600;letter-spacing:-.02em">${c.n}</div></a>${i < counts.length - 1 ? `<span style="align-self:center;color:var(--muted)">${ico('chevR', 16)}</span>` : ''}`).join('')}</div></section>
  <div class="grid g-wide mt">
    <section class="card"><div class="card-h"><h2>Joylash navbati</h2><span class="sub">worker shu tartibda joylaydi</span>
      <div class="right"><label class="tag" style="cursor:pointer"><input type="checkbox" data-change="autoPublish" ${S.workspace.autoPublish ? 'checked' : ''} style="accent-color:var(--accent)"> Simulyatsiya (server o‘zi joylaydi)</label></div></div>
      <div class="table-wrap"><table><thead><tr><th>Qachon</th><th>Platforma</th><th>Video</th><th>Tayyorlik</th><th class="r">Prognoz</th><th></th></tr></thead><tbody>
      ${q.map((x) => { const v = S.videos.find((y) => y.id === x.videoId); const f = C.forecast(S, t, v, x.platform, x.scheduledAt); return `<tr><td class="nowrap">${C.relDay(x.scheduledAt, t)}, <b>${fmtTime(x.scheduledAt)}</b></td><td>${pf(x.platform)}</td><td><span class="vt" style="max-width:240px;cursor:pointer" data-act="open" data-id="${x.videoId}">${esc(x.title)}</span></td><td>${x.ready ? '<span class="tag good"><span class="dot"></span>Tayyor</span>' : `<span class="tag ${x.dueIn < DAY ? 'critical' : 'warning'}"><span class="dot"></span>${Math.round(x.readiness * 100)}%</span>`}</td><td class="r">${f ? fmtNum(f.mid) : '—'}</td><td class="r"><button class="btn sm ghost" data-act="publish-post" data-post="${x.postId}" title="Hozir joylash">${ico('play', 14)}</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Navbat bo‘sh</td></tr>'}
      </tbody></table></div></section>
    ${alertsCard(S, t, 10)}
  </div>
  <section class="card mt"><div class="card-h"><h2>API — avtomatlashtirish uchun</h2><span class="sub">${store.mode === 'server' ? 'server ishlayapti' : 'demo rejimda API yo‘q — <code>npm start</code> bilan serverni ishga tushiring'}</span></div>
    <div class="grid g-2">
      <div>
        ${ep('GET', '/api/queue/next', 'Keyingi tayyor post (worker uchun): sarlavha, platforma, vaqt, tavsif + hashtag')}
        ${ep('GET', '/api/queue', 'To‘liq navbat, tayyorlik foizi bilan')}
        ${ep('POST', '/api/posts/:id/published', 'Worker joyladi: <code>{url, publishedAt}</code>')}
        ${ep('POST', '/api/posts/:id/failed', 'Xato bo‘ldi: <code>{error}</code> — panelda ogohlantirish chiqadi')}
        ${ep('POST', '/api/posts/:id/stats', 'Statistika: <code>{stats:{views,likes,comments,shares,saves,subs,retention}}</code>')}
        ${ep('POST', '/api/videos', 'Yangi g‘oya/video: <code>{title, topic, format}</code> (masalan render.mjs dan)')}
        ${ep('GET', '/api/export.csv', 'Barcha postlar CSV (Excel uchun)')}
      </div>
      <div>
        <div class="muted" style="font-size:12.5px">Misol: statistikani yuborish</div>
<pre class="code">curl -X POST ${esc(base)}/api/posts/p12/stats \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $ADMIN_TOKEN" \\
  -d '{"stats":{"views":15420,"likes":980,"subs":120}}'</pre>
        <div class="muted" style="font-size:12.5px;margin-top:14px">Misol: worker (har daqiqada)</div>
<pre class="code">npm run worker   # tools/worker.mjs
# navbatdan tayyor postni oladi → platformaga yuklaydi
# → /published yoki /failed ga xabar beradi</pre>
      </div>
    </div></section>`;
}

// ---------- SOZLAMALAR ----------
function pageSettings(S) {
  const theme = ls.get(LS_THEME) || 'system';
  return `<div class="grid g-2">
    <section class="card"><div class="card-h"><h2>Ish joyi</h2></div>
      <form class="grid" style="gap:14px" data-form="workspace">
        <label class="field"><span>Nomi</span><input class="input" name="name" value="${esc(S.workspace.name)}" maxlength="40"></label>
        <label class="field"><span>Vaqt mintaqasi</span><input class="input" value="Asia/Tashkent (UTC+5)" disabled></label>
        <div><button class="btn primary">Saqlash</button></div>
      </form></section>
    <section class="card"><div class="card-h"><h2>Maqsadlar</h2></div>
      <form class="grid" style="gap:14px" data-form="goals">
        <label class="field"><span>Oylik yangi obunachilar</span><input class="input" type="number" min="0" name="monthlySubs" value="${S.goals.monthlySubs}"></label>
        <label class="field"><span>Oylik ko‘rishlar</span><input class="input" type="number" min="0" name="monthlyViews" value="${S.goals.monthlyViews}"></label>
        <label class="field"><span>Haftalik videolar</span><input class="input" type="number" min="0" name="weeklyVideos" value="${S.goals.weeklyVideos}"></label>
        <div><button class="btn primary">Saqlash</button></div>
      </form></section>
    <section class="card"><div class="card-h"><h2>Ko‘rinish</h2></div>
      <div class="seg">${[['system', 'Tizim'], ['dark', 'Qorong‘i'], ['light', 'Yorug‘']].map(([k, n]) => `<button data-act="set-theme" data-v="${k}" aria-pressed="${theme === k}">${n}</button>`).join('')}</div>
      <p class="muted" style="font-size:12.5px">Tezkor tugmalar: <span class="kbd">Ctrl K</span> qidirish, <span class="kbd">N</span> yangi video, <span class="kbd">Esc</span> yopish.</p></section>
    <section class="card"><div class="card-h"><h2>Ma’lumotlar</h2><span class="sub">${store.mode === 'server' ? 'serverda: data/db.json' : 'brauzer xotirasida (demo)'}</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-act="export-json">${ico('download', 16)}JSON eksport</button>
        <button class="btn" data-act="export-csv">${ico('download', 16)}CSV eksport</button>
        <label class="btn">${ico('upload', 16)}JSON import<input type="file" accept="application/json" data-change="import" hidden></label>
        <button class="btn danger" data-act="reset">${ico('refresh', 16)}Demo ma’lumotlarni tiklash</button>
      </div>
      <p class="muted" style="font-size:12.5px">Videolar: ${S.videos.length} · Postlar: ${C.allPosts(S).length} · Oxirgi yangilanish: ${fmtDate(S.updatedAt)} ${fmtTime(S.updatedAt)}</p></section>
  </div>`;
}

// ---------- DRAWER: video tafsilotlari ----------
function drawer(S, t) {
  const v = S.videos.find((x) => x.id === ui.drawer?.id);
  if (!v) return '';
  const st = C.videoStats(v, t);
  const published = v.posts.filter((p) => p.status === 'published');
  const r = C.readiness(v);
  const sc = v.script || {};
  // o'sish grafigi
  let growth = '';
  if (published.length) {
    const t0 = Math.min(...published.map((p) => p.publishedAt));
    const horizon = Math.min(14 * DAY, t - t0);
    const step = horizon <= 2 * DAY ? 2 * HOUR : horizon <= 5 * DAY ? 6 * HOUR : 12 * HOUR;
    const pts = []; for (let x = 0; x <= horizon + 1; x += step) pts.push(t0 + x);
    if (pts.at(-1) < t0 + horizon) pts.push(t0 + horizon);
    const ids = [...new Set(published.map((p) => p.platform))];
    const series = ids.map((id) => ({ id, name: pname(id), color: PC(id), values: pts.map((x) => published.filter((p) => p.platform === id).reduce((a, p) => a + C.postStats(p, x).views, 0)) }));
    charts.push({ id: 'growth', draw: (el) => lineChart(el, { labels: pts.map((x) => { const h = Math.round((x - t0) / HOUR); return h < 48 ? h + 's' : Math.round(h / 24) + 'k'; }), tipLabels: pts.map((x) => `${fmtDate(x)} ${fmtTime(x)} · joylangandan ${C.fmtDur(x - t0)}`), series, total: true, height: 210, aria: 'Ko‘rishlar o‘sishi' }) });
    growth = `<div class="legend" style="margin-top:16px">${series.map((s) => `<button aria-pressed="true" tabindex="-1"><i style="background:${s.color}"></i>${s.name}</button>`).join('')}<span class="muted" style="font-size:12px;margin-left:auto">s = soat, k = kun</span></div><div class="chart" id="growth"></div>`;
  }
  const words = [sc.hook, sc.body, sc.cta].join(' ').split(/\s+/).filter(Boolean).length;
  const hookWords = (sc.hook || '').split(/\s+/).filter(Boolean).length;
  const def = ui.drawer.def || dtLocal(Math.max(t + 2 * HOUR, C.at(t + DAY, 19)));
  return `<div class="scrim" data-act="close"></div>
  <aside class="drawer" role="dialog" aria-label="Video tafsilotlari" data-scroll="drawer">
    <div class="drawer-h">
      <div class="row"><input class="title" value="${esc(v.title)}" data-vfield="title" aria-label="Sarlavha"><button class="btn icon ghost" data-act="close" aria-label="Yopish">${ico('x')}</button></div>
      <div class="meta">
        <select class="input" style="width:auto;height:30px" data-vfield="status" aria-label="Bosqich">${C.STAGES.map((s) => opt(s.id, s.name, v.status === s.id)).join('')}</select>
        <select class="input" style="width:auto;height:30px" data-vfield="topic" aria-label="Mavzu">${C.TOPICS.map((x) => opt(x, x, v.topic === x)).join('')}</select>
        <select class="input" style="width:auto;height:30px" data-vfield="format" aria-label="Format">${C.FORMATS.map((x) => opt(x.id, x.name, v.format === x.id)).join('')}</select>
        <select class="input" style="width:auto;height:30px" data-vfield="owner" aria-label="Mas’ul">${['Sardor', 'Madina', 'Jasur'].map((x) => opt(x, x, v.owner === x)).join('')}</select>
      </div>
    </div>
    <div class="drawer-b">
      ${published.length ? `<section class="sec"><h3>Natija</h3>
        <div class="mini-stats"><div><div class="k">Ko‘rishlar</div><div class="v">${fmtNum(st.views)}</div></div><div><div class="k">+Obunachi</div><div class="v">+${fmtNum(st.subs)}</div></div><div><div class="k">ER</div><div class="v">${pct(st.er)}</div></div><div><div class="k">Tomosha</div><div class="v">${pct(st.retention, 0)}</div></div></div>
        ${growth}
        <div class="table-wrap" style="margin-top:14px"><table><thead><tr><th>Platforma</th><th>Joylangan</th><th class="r">Ko‘rish</th><th class="r">Layk</th><th class="r">Izoh</th><th class="r">Ulash.</th><th class="r">Saql.</th><th class="r">+Obun.</th></tr></thead><tbody>
        ${published.map((p) => { const s = C.postStats(p, t); return `<tr><td>${pf(p.platform)}</td><td class="nowrap">${fmtDate(p.publishedAt)}, ${fmtTime(p.publishedAt)}</td><td class="r">${fmtFull(s.views)}</td><td class="r">${fmtFull(s.likes)}</td><td class="r">${fmtFull(s.comments)}</td><td class="r">${fmtFull(s.shares)}</td><td class="r">${fmtFull(s.saves)}</td><td class="r">+${fmtFull(s.subs)}</td></tr>`; }).join('')}
        </tbody></table></div></section>` : ''}
      <section class="sec"><h3>Joylashlar <span class="muted" style="font-weight:400;font-family:var(--font-ui)">${v.posts.length}</span></h3>
        ${v.posts.sort((a, b) => (a.publishedAt || a.scheduledAt) - (b.publishedAt || b.scheduledAt)).map((p) => {
          const at = p.publishedAt || p.scheduledAt; const f = p.status === 'scheduled' ? C.forecastPost(S, t, v, p) : null; const d = dtLocal(at);
          return `<div class="post-row"><div style="min-width:0"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${pf(p.platform)}${postTag(p.status)}<span class="t2" style="font-size:13px">${C.relDay(at, t)}, ${fmtTime(at)}</span></div>
            ${p.error ? `<div style="color:var(--critical-text);font-size:12.5px;margin-top:4px">${esc(p.error)}</div>` : ''}
            ${f ? `<div class="muted" style="font-size:12.5px;margin-top:4px">Prognoz: <b class="t2">${fmtNum(f.lo)}–${fmtNum(f.hi)}</b> ko‘rish, <b class="t2">+${fmtNum(f.subs)}</b> obunachi</div>` : ''}
            ${p.status === 'scheduled' ? `<div style="display:flex;gap:6px;margin-top:8px"><input class="input" type="date" value="${d.date}" style="height:30px;width:auto" data-resched="${p.id}" data-part="date" aria-label="Sana"><input class="input" type="time" value="${d.time}" style="height:30px;width:auto" data-resched="${p.id}" data-part="time" aria-label="Vaqt"></div>` : ''}</div>
            <div class="acts">${p.status === 'scheduled' ? `<button class="btn sm" data-act="publish-post" data-post="${p.id}">${ico('play', 14)}Hozir</button><button class="btn sm ghost danger" data-act="remove-post" data-post="${p.id}" aria-label="Rejadan olib tashlash">${ico('trash', 14)}</button>` : ''}${p.status === 'failed' || p.status === 'missed' ? `<button class="btn sm" data-act="retry" data-post="${p.id}">${ico('refresh', 14)}Qayta urinish</button><button class="btn sm ghost danger" data-act="remove-post" data-post="${p.id}" aria-label="O‘chirish">${ico('trash', 14)}</button>` : ''}${p.status === 'published' && p.url ? `<a class="btn sm ghost" href="${esc(p.url)}" target="_blank" rel="noopener">${ico('link', 14)}Havola</a>` : ''}</div></div>`;
        }).join('') || '<p class="muted" style="margin:0">Hali rejalashtirilmagan</p>'}
        <form class="inline-form" data-form="add-post" data-id="${v.id}">
          <label class="field"><span>Platforma</span><select class="input" name="platform">${C.PLATFORMS.filter((p) => !v.posts.some((x) => x.platform === p.id && x.status !== 'failed' && x.status !== 'missed')).map((p) => opt(p.id, p.name)).join('')}</select></label>
          <label class="field"><span>Sana</span><input class="input" type="date" name="date" value="${def.date}" required></label>
          <label class="field"><span>Vaqt</span><input class="input" type="time" name="time" value="${def.time}" required></label>
          <button class="btn primary">${ico('plus', 15)}Qo‘shish</button>
        </form>
        <div class="muted" style="font-size:12.5px;margin-top:8px" id="add-fc"></div>
      </section>
      <section class="sec" id="sec-ready"><h3>Tayyorlik <span class="right t2" style="font-family:var(--font-ui);font-weight:600">${Math.round(r * 100)}%</span></h3>
        <div style="margin-bottom:12px">${meter(r)}</div>
        <div class="checks">${C.CHECKLIST.map((c) => `<label class="check ${v.checklist[c.id] ? 'on' : ''}"><input type="checkbox" data-check="${c.id}" ${v.checklist[c.id] ? 'checked' : ''}><span class="box">${ico('check', 13)}</span><span>${esc(c.name)}</span></label>`).join('')}</div></section>
      <section class="sec" id="sec-script"><h3>Ssenariy <span class="right"><select class="input" style="height:30px;width:auto" data-change="template" aria-label="Shablon"><option value="">Shablon qo‘llash…</option>${C.SCRIPT_TEMPLATES.map((x) => opt(x.id, x.name)).join('')}</select></span></h3>
        <div class="script-grid">
          <label class="field"><span>Hook — birinchi 2–3 soniya</span><input class="input" data-script="hook" value="${esc(sc.hook)}" placeholder="Tomoshabinni to‘xtatadigan birinchi gap"></label>
          <label class="field"><span>Asosiy qism</span><textarea class="input" rows="6" data-script="body" placeholder="Kadrma-kadr yoki punktlar bilan">${esc(sc.body)}</textarea></label>
          <label class="field"><span>CTA — chaqiriq</span><input class="input" data-script="cta" value="${esc(sc.cta)}" placeholder="Obuna bo‘ling, saqlang, izoh qoldiring…"></label>
          <div class="script-meta" id="script-meta">${scriptMeta(words, hookWords, v)}</div>
          <label class="field"><span>Tavsif (caption)</span><textarea class="input" rows="3" data-script="description">${esc(sc.description)}</textarea></label>
          <label class="field"><span>Hashtaglar</span><input class="input" data-script="hashtags" value="${esc(sc.hashtags)}"></label>
        </div></section>
      <section class="sec"><h3>Izohlar</h3><textarea class="input" rows="3" data-vfield="notes" placeholder="Jamoa uchun eslatmalar, havolalar, musiqa manbasi…">${esc(v.notes)}</textarea></section>
      <section class="sec" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span class="muted" style="font-size:12.5px">ID: ${v.id} · yaratildi ${fmtDate(v.createdAt)}</span><button class="btn sm danger" data-act="delete-video" data-id="${v.id}">${ico('trash', 14)}Videoni o‘chirish</button></section>
    </div>
  </aside>`;
}
function scriptMeta(words, hookWords, v) {
  const sec = Math.round(words / 2.5);
  const target = v.format === 'long' ? v.duration : v.duration;
  return `<span>So‘zlar: <b>${words}</b></span><span>Taxminiy davomiylik: <b>${sec} s</b> <span class="muted">(maqsad ~${target} s)</span></span><span>Hook: <b style="color:${hookWords > 12 ? 'var(--critical-text)' : 'inherit'}">${hookWords} so‘z</b>${hookWords > 12 ? ' — qisqartiring (≤12)' : ''}</span>`;
}

// ---------- MODALLAR ----------
function modal(S, t) {
  const m = ui.modal;
  if (!m) return '';
  if (m.type === 'new') return `<div class="scrim" data-act="close-modal"></div><div class="modal" role="dialog" aria-label="Yangi video">
    <form data-form="new-video"><div class="modal-h"><h2>Yangi video</h2><button type="button" class="btn icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="Yopish">${ico('x')}</button></div>
    <div class="modal-b">
      <label class="field"><span>Sarlavha</span><input class="input" name="title" required maxlength="140" placeholder="Masalan: 3 ta AI vosita, ishni 2 baravar tezlashtiradi" autofocus></label>
      <div class="row2"><label class="field"><span>Mavzu</span><select class="input" name="topic">${C.TOPICS.map((x) => opt(x, x)).join('')}</select></label>
      <label class="field"><span>Format</span><select class="input" name="format">${C.FORMATS.map((x) => opt(x.id, x.name)).join('')}</select></label></div>
      <div class="row2"><label class="field"><span>Bosqich</span><select class="input" name="status">${C.STAGES.slice(0, 4).map((x) => opt(x.id, x.name)).join('')}</select></label>
      <label class="field"><span>Mas’ul</span><select class="input" name="owner">${['Sardor', 'Madina', 'Jasur'].map((x) => opt(x, x)).join('')}</select></label></div>
      <label class="field"><span>Hook g‘oyasi (ixtiyoriy)</span><input class="input" name="hook" placeholder="Birinchi 3 soniyada nima deyiladi?"></label>
    </div>
    <div class="modal-f"><button type="button" class="btn ghost" data-act="close-modal">Bekor qilish</button><button class="btn primary">Yaratish</button></div></form></div>`;
  if (m.type === 'schedule') {
    const vids = S.videos.filter((v) => v.status !== 'published').sort((a, b) => C.readiness(b) - C.readiness(a));
    const d = dtLocal(m.date || Math.max(t + 2 * HOUR, C.at(t + DAY, 19)));
    return `<div class="scrim" data-act="close-modal"></div><div class="modal" role="dialog" aria-label="Rejalashtirish">
    <form data-form="schedule"><div class="modal-h"><h2>Rejalashtirish</h2><button type="button" class="btn icon ghost" style="margin-left:auto" data-act="close-modal" aria-label="Yopish">${ico('x')}</button></div>
    <div class="modal-b">
      <label class="field"><span>Video</span><select class="input" name="video" required>${vids.map((v) => opt(v.id, `${v.title} — ${Math.round(C.readiness(v) * 100)}% tayyor`, m.videoId === v.id)).join('')}</select></label>
      <div class="field"><span>Platformalar</span><div class="pf-pick">${C.PLATFORMS.map((p, i) => `<label><input type="checkbox" name="pf" value="${p.id}" ${i < 3 ? 'checked' : ''}>${pf(p.id)}</label>`).join('')}</div></div>
      <div class="row2"><label class="field"><span>Sana</span><input class="input" type="date" name="date" value="${d.date}" required></label><label class="field"><span>Vaqt (Toshkent)</span><input class="input" type="time" name="time" value="${d.time}" required></label></div>
      <div class="hint" id="sched-fc"></div>
    </div>
    <div class="modal-f"><button type="button" class="btn ghost" data-act="close-modal">Bekor qilish</button><button class="btn primary">Rejaga qo‘shish</button></div></form></div>`;
  }
  return '';
}

function updateScheduleHint() {
  const form = $('form[data-form="schedule"]');
  const box = $('#sched-fc');
  if (!form || !box) return;
  const S = store.S, t = now();
  const v = S.videos.find((x) => x.id === form.video.value);
  const pfsel = [...form.querySelectorAll('input[name=pf]:checked')].map((i) => i.value);
  const when = fromLocal(form.date.value, form.time.value);
  if (!v || !pfsel.length || !when) { box.innerHTML = 'Video va kamida bitta platformani tanlang.'; return; }
  const rows = pfsel.map((id) => ({ id, f: C.forecast(S, t, v, id, when), b: C.bestSlots(S, t, id, 2) }));
  const tot = rows.reduce((a, r) => ({ mid: a.mid + (r.f?.mid || 0), subs: a.subs + (r.f?.subs || 0) }), { mid: 0, subs: 0 });
  const r = C.readiness(v);
  box.innerHTML = `<b style="color:var(--text)">Prognoz: ~${fmtNum(tot.mid)} ko‘rish, +${fmtNum(tot.subs)} obunachi</b>
    ${rows.map((x) => `<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px">${pf(x.id)}<span>${x.f ? `${fmtNum(x.f.lo)}–${fmtNum(x.f.hi)} · soat omili ${x.f.factors.soat.toFixed(2)}×` : 'ma’lumot yo‘q'}</span></div>`).join('')}
    ${when < t ? '<div style="color:var(--critical-text);margin-top:8px">Vaqt o‘tib ketgan — kelajakdagi vaqtni tanlang.</div>' : ''}
    ${r < 1 && when - t < 2 * DAY ? `<div style="color:var(--warning);margin-top:8px">Diqqat: video ${Math.round(r * 100)}% tayyor, joylashga ${C.fmtDur(when - t)} qoladi.</div>` : ''}
    <div class="chips">${[...new Map(rows.flatMap((x) => x.b).map((b) => [b.slot, b])).values()].slice(0, 4).map((b) => `<button type="button" class="btn sm" data-act="set-time" data-v="${String(C.SLOTS[b.slot] + 1).padStart(2, '0')}:00">${ico('clock', 13)}${String(C.SLOTS[b.slot] + 1).padStart(2, '0')}:00 tavsiya</button>`).join('')}</div>`;
}
function updateAddPostHint() {
  const form = $('form[data-form="add-post"]');
  const box = $('#add-fc');
  if (!form || !box) return;
  const v = store.S.videos.find((x) => x.id === form.dataset.id);
  const when = fromLocal(form.date.value, form.time.value);
  const f = v && form.platform.value && when ? C.forecast(store.S, now(), v, form.platform.value, when) : null;
  box.innerHTML = f ? `Shu vaqt uchun prognoz: <b class="t2">${fmtNum(f.lo)}–${fmtNum(f.hi)}</b> ko‘rish (median ${fmtNum(f.mid)}), +${fmtNum(f.subs)} obunachi · ishonch: ${f.confidence}` : '';
}

// ---------- buyruqlar palitrasi ----------
function paletteItems(q) {
  const items = [
    ...NAV.filter((n) => !n.sep).map((n) => ({ label: n.name, hint: 'Sahifa', run: () => go(n.hash ?? n.id) })),
    { label: 'Yangi video yaratish', hint: 'N', run: () => openModal({ type: 'new' }) },
    { label: 'Video rejalashtirish', hint: 'Amal', run: () => openModal({ type: 'schedule' }) },
    { label: 'Mavzuni almashtirish (qorong‘i / yorug‘)', hint: 'Amal', run: toggleTheme },
    { label: 'CSV eksport', hint: 'Amal', run: exportCSV },
    ...store.S.videos.map((v) => ({ label: v.title, hint: C.stageName(v.status), run: () => openDrawer(v.id) })),
  ];
  const s = q.trim().toLowerCase();
  return (s ? items.filter((i) => i.label.toLowerCase().includes(s)) : items.slice(0, 12)).slice(0, 30);
}
function renderPalette() {
  let el = $('#palette-root');
  if (!ui.palette) { if (el) el.innerHTML = ''; return; }
  const items = paletteItems(ui.palette.q);
  ui.palette.sel = Math.min(ui.palette.sel, Math.max(0, items.length - 1));
  el.innerHTML = `<div class="scrim" data-act="close-palette"></div><div class="modal palette" role="dialog" aria-label="Buyruqlar"><input id="pal-in" placeholder="Sahifa, video yoki amal…" value="${esc(ui.palette.q)}" aria-label="Qidirish"><ul role="listbox">${items.map((it, i) => `<li role="option" aria-selected="${i === ui.palette.sel}" data-pal="${i}">${esc(it.label)}<span class="k">${esc(it.hint)}</span></li>`).join('') || '<li>Hech narsa topilmadi</li>'}</ul></div>`;
  ui.palette.items = items;
  const inp = $('#pal-in'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
}

// ---------- render ----------
function render() {
  const S = store.S, t = now();
  charts = [];
  const pages = { dashboard: pageDashboard, videolar: pageVideos, reja: pageCalendar, ssenariylar: pageScripts, tahlil: pageAnalytics, platformalar: pagePlatforms, konveyer: pageFactory, sozlamalar: pageSettings };
  const prevScroll = $('.drawer')?.scrollTop || 0;
  $('#app').innerHTML = shell(pages[ui.route](S, t));
  $('#overlay').innerHTML = drawer(S, t) + modal(S, t);
  const dr = $('.drawer'); if (dr && ui.keepScroll) dr.scrollTop = prevScroll;
  ui.keepScroll = false;
  document.title = `${TITLES[ui.route][0]} · ${S.workspace.name}`;
  mountCharts();
  updateScheduleHint(); updateAddPostHint();
  if (ui.drawer?.sec && !ui.drawer.scrolled) { $('#sec-' + ui.drawer.sec)?.scrollIntoView({ block: 'start' }); ui.drawer.scrolled = true; }
}
function mountCharts() { for (const c of charts) { const el = document.getElementById(c.id); if (el) c.draw(el); } }

function go(hash) { location.hash = '#/' + hash; }
function openDrawer(id, sec) { ui.drawer = { id, sec }; render(); }
function openModal(m) { ui.modal = m; render(); setTimeout(() => $('.modal input[autofocus]')?.focus(), 0); }
function toast(msg, err) {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg; box.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
function applyTheme() {
  const th = ls.get(LS_THEME) || 'system';
  const dark = th === 'dark' || (th === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
function toggleTheme() { ls.set(LS_THEME, document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); applyTheme(); render(); }
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportCSV() { download(`kontent-zavod-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + C.toCSV(store.S, now()), 'text/csv;charset=utf-8'); }

// ---------- hodisalar ----------
document.addEventListener('click', async (e) => {
  const pal = e.target.closest('[data-pal]');
  if (pal && ui.palette) { const it = ui.palette.items[+pal.dataset.pal]; ui.palette = null; renderPalette(); it?.run(); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  if (el.tagName === 'A' && !el.dataset.act) return;
  const a = el.dataset.act, d = el.dataset;
  const S = store.S;
  switch (a) {
    case 'menu': ui.menu = !ui.menu; render(); break;
    case 'theme': toggleTheme(); break;
    case 'set-theme': ls.set(LS_THEME, d.v); applyTheme(); render(); break;
    case 'palette': ui.palette = { q: '', sel: 0 }; renderPalette(); break;
    case 'close-palette': ui.palette = null; renderPalette(); break;
    case 'new-video': openModal({ type: 'new' }); break;
    case 'schedule': openModal({ type: 'schedule', date: d.date ? +d.date : null, videoId: d.id }); break;
    case 'close-modal': ui.modal = null; render(); break;
    case 'close': ui.drawer = null; render(); break;
    case 'open': if (e.target.closest('button,select,input,a') && e.target.closest('button,select,input,a') !== el) return; openDrawer(d.id, d.sec); break;
    case 'period': ui.period = +d.v; render(); break;
    case 'legend': ui.hidden[d.k] = !ui.hidden[d.k]; render(); break;
    case 'sort': ui.sort = { key: d.k, dir: ui.sort.key === d.k ? -ui.sort.dir : -1 }; $('#vtable').innerHTML = videosTable(S, now()); break;
    case 'more': ui.vLimit += 40; $('#vtable').innerHTML = videosTable(S, now()); break;
    case 'cal': {
      if (+d.d === 0) ui.cal = null; else { let { y, m } = ui.cal; m += +d.d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } ui.cal = { y, m }; }
      render(); break;
    }
    case 'check': await act('video.check', { id: d.id, key: d.key, value: d.val === '1' }); break;
    case 'retry': await act('post.retry', { postId: d.post }, 'Qayta urinish 15 daqiqadan so‘ng'); break;
    case 'reconnect': await act('platform.update', { id: d.pf, patch: { connected: true } }, `${pname(d.pf)} ulandi (token 60 kunga yangilandi)`); break;
    case 'disconnect': if (confirm(`${pname(d.pf)} uzilsinmi? Avtomatik joylash to‘xtaydi.`)) await act('platform.update', { id: d.pf, patch: { connected: false } }, 'Uzildi'); break;
    case 'publish-post': if (confirm('Hozir joylansinmi? Tayyorlik ro‘yxati to‘liq belgilanadi.')) { ui.keepScroll = true; await act('post.publishNow', { postId: d.post }, 'Joylandi'); } break;
    case 'publish-video': {
      const v = S.videos.find((x) => x.id === d.id);
      if (!confirm(`“${v.title}” barcha rejadagi platformalarga hozir joylansinmi?`)) break;
      for (const p of v.posts.filter((x) => x.status === 'scheduled')) await act('post.publishNow', { postId: p.id }, null, { silent: true });
      toast('Joylandi'); render(); break;
    }
    case 'remove-post': if (confirm('Bu joylash rejadan olib tashlansinmi?')) { ui.keepScroll = true; await act('post.remove', { postId: d.post }, 'Olib tashlandi'); } break;
    case 'delete-video': if (confirm('Video butunlay o‘chirilsinmi? Buni qaytarib bo‘lmaydi.')) { ui.drawer = null; await act('video.delete', { id: d.id }, 'O‘chirildi'); } break;
    case 'set-time': { const f = $('form[data-form="schedule"]'); if (f) { f.time.value = d.v; updateScheduleHint(); } break; }
    case 'export-csv': exportCSV(); break;
    case 'export-json': download(`kontent-zavod-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(S, null, 1), 'application/json'); break;
    case 'reset':
      if (!confirm('Barcha ma’lumotlar demo holatiga qaytarilsinmi?')) break;
      if (store.mode === 'server') { await fetch('api/reset', { method: 'POST', headers: ls.get(LS_TOKEN) ? { Authorization: 'Bearer ' + ls.get(LS_TOKEN) } : {} }); await load(); }
      else { store.S = C.seed(now()); saveLocal(); }
      toast('Tiklandi'); render(); break;
  }
});

document.addEventListener('change', async (e) => {
  const el = e.target, d = el.dataset;
  const S = store.S;
  if (d.change) {
    const k = d.change;
    if (k === 'pf') { ui.pf = el.value; render(); }
    else if (k === 'heatPf') { ui.heatPf = el.value; render(); }
    else if (k.startsWith('vf.')) { ui.vf[k.slice(3)] = el.value; ui.vLimit = 40; $('#vtable').innerHTML = videosTable(S, now()); }
    else if (k === 'autoPublish') await act('workspace.update', { autoPublish: el.checked }, el.checked ? 'Avtomatik joylash yoqildi' : 'Avtomatik joylash o‘chirildi');
    else if (k === 'template' && el.value) {
      const tpl = C.SCRIPT_TEMPLATES.find((x) => x.id === el.value);
      ui.keepScroll = true;
      await act('video.update', { id: ui.drawer.id, patch: { script: { template: tpl.id, hook: tpl.hook, body: tpl.body, cta: tpl.cta } } }, `“${tpl.name}” shabloni qo‘llandi`);
    } else if (k === 'import') {
      const file = el.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!Array.isArray(data.videos)) throw new Error('Fayl formati noto‘g‘ri');
        if (store.mode === 'server') { const r = await fetch('api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(ls.get(LS_TOKEN) ? { Authorization: 'Bearer ' + ls.get(LS_TOKEN) } : {}) }, body: JSON.stringify(data) }); if (!r.ok) throw new Error((await r.json()).error); await load(); }
        else { store.S = C.tick(data, now()); saveLocal(); }
        toast('Import qilindi'); render();
      } catch (err) { toast(err.message, true); }
    }
    return;
  }
  if (d.vfield && ui.drawer) {
    ui.keepScroll = true;
    if (d.vfield === 'status') await act('video.move', { id: ui.drawer.id, status: el.value });
    else await act('video.update', { id: ui.drawer.id, patch: { [d.vfield]: el.value } }, null);
    return;
  }
  if (d.script && ui.drawer) { ui.keepScroll = true; await act('video.update', { id: ui.drawer.id, patch: { script: { [d.script]: el.value } } }, null, { silent: true }); return; }
  if (d.check && ui.drawer) { ui.keepScroll = true; await act('video.check', { id: ui.drawer.id, key: d.check, value: el.checked }); return; }
  if (d.resched) {
    const row = el.closest('.post-row');
    const date = row.querySelector('[data-part=date]').value, time = row.querySelector('[data-part=time]').value;
    ui.keepScroll = true;
    await act('post.reschedule', { postId: d.resched, scheduledAt: fromLocal(date, time) }, 'Vaqt o‘zgartirildi');
    return;
  }
  if (el.closest('form[data-form="schedule"]')) updateScheduleHint();
  if (el.closest('form[data-form="add-post"]')) updateAddPostHint();
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.input === 'vq') { ui.vf.q = el.value; ui.vLimit = 40; const tbl = $('#vtable'); tbl.innerHTML = videosTable(store.S, now()); return; }
  if (el.id === 'pal-in') { ui.palette.q = el.value; ui.palette.sel = 0; renderPalette(); return; }
  if (el.dataset.script) {
    const get = (k) => $(`[data-script="${k}"]`)?.value || '';
    const words = [get('hook'), get('body'), get('cta')].join(' ').split(/\s+/).filter(Boolean).length;
    const v = store.S.videos.find((x) => x.id === ui.drawer?.id);
    if (v) $('#script-meta').innerHTML = scriptMeta(words, get('hook').split(/\s+/).filter(Boolean).length, v);
  }
});

document.addEventListener('submit', async (e) => {
  const f = e.target; const k = f.dataset.form;
  if (!k) return;
  e.preventDefault();
  const fd = Object.fromEntries(new FormData(f));
  if (k === 'new-video') {
    const v = await act('video.create', fd, 'Video yaratildi', { silent: true });
    ui.modal = null;
    if (v) openDrawer(v.id, 'script'); else render();
  } else if (k === 'quick-idea') {
    await act('video.create', { title: fd.title, status: 'idea' }, 'G‘oya qo‘shildi');
  } else if (k === 'schedule') {
    const when = fromLocal(fd.date, fd.time);
    const list = [...f.querySelectorAll('input[name=pf]:checked')].map((i) => i.value);
    if (!list.length) return toast('Platformani tanlang', true);
    if (when < now()) return toast('Vaqt o‘tib ketgan', true);
    for (const p of list) await act('post.schedule', { videoId: fd.video, platform: p, scheduledAt: when }, null, { silent: true });
    ui.modal = null; toast(`${list.length} ta platformaga rejalashtirildi`); render();
  } else if (k === 'add-post') {
    const when = fromLocal(fd.date, fd.time);
    if (when < now()) return toast('Vaqt o‘tib ketgan', true);
    ui.keepScroll = true;
    await act('post.schedule', { videoId: f.dataset.id, platform: fd.platform, scheduledAt: when }, `${pname(fd.platform)}ga rejalashtirildi`);
  } else if (k === 'goals') await act('goals.update', fd, 'Maqsadlar saqlandi');
  else if (k === 'workspace') await act('workspace.update', { name: fd.name.trim() || 'Kontent Zavod' }, 'Saqlandi');
});

// kanban: sudrab o'tkazish
document.addEventListener('dragstart', (e) => { const c = e.target.closest?.('[data-drag]'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.drag); c.classList.add('dragging'); });
document.addEventListener('dragend', (e) => e.target.classList?.remove('dragging'));
document.addEventListener('dragover', (e) => { const col = e.target.closest?.('[data-drop]'); if (!col) return; e.preventDefault(); document.querySelectorAll('.col.drop').forEach((x) => x !== col && x.classList.remove('drop')); col.classList.add('drop'); });
document.addEventListener('drop', async (e) => {
  const col = e.target.closest?.('[data-drop]'); if (!col) return;
  e.preventDefault(); col.classList.remove('drop');
  const id = e.dataTransfer.getData('text/plain'); const v = store.S.videos.find((x) => x.id === id);
  if (v && v.status !== col.dataset.drop) await act('video.move', { id, status: col.dataset.drop }, `${C.stageName(col.dataset.drop)} bosqichiga o‘tdi`);
});

// heatmap tooltip
document.addEventListener('mousemove', (e) => {
  const c = e.target.closest?.('[data-tip]');
  if (!c) { if (document.querySelector('.heat')) hideTip(); return; }
  const [h, a, b] = c.dataset.tip.split('|');
  showTip(`<div class="th">${esc(h)}</div><div class="tr"><span>${esc(a)}</span></div><div class="tr"><span class="muted">${esc(b)}</span></div>`, e.clientX, e.clientY);
});

document.addEventListener('keydown', (e) => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.palette = ui.palette ? null : { q: '', sel: 0 }; renderPalette(); return; }
  if (ui.palette) {
    if (e.key === 'Escape') { ui.palette = null; renderPalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); ui.palette.sel = Math.min(ui.palette.sel + 1, ui.palette.items.length - 1); renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); ui.palette.sel = Math.max(0, ui.palette.sel - 1); renderPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = ui.palette.items[ui.palette.sel]; ui.palette = null; renderPalette(); it?.run(); }
    return;
  }
  if (e.key === 'Escape') { if (ui.modal) { ui.modal = null; render(); } else if (ui.drawer) { ui.drawer = null; render(); } else if (ui.menu) { ui.menu = false; render(); } return; }
  if (!typing && e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); openModal({ type: 'new' }); }
});

window.addEventListener('hashchange', () => { routeFromHash(); ui.menu = false; ui.drawer = null; render(); window.scrollTo(0, 0); });
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(mountCharts, 120); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); render(); });

// jonli yangilanish: sanoq har soniya, ma'lumot har daqiqa
setInterval(() => { const t = now(); document.querySelectorAll('[data-countdown]').forEach((el) => (el.textContent = cd(+el.dataset.countdown - t))); }, 1000);
setInterval(async () => {
  const busy = ui.modal || ui.palette || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
  if (store.mode === 'server') { try { const j = await (await fetch('api/state', { cache: 'no-store' })).json(); store.S = j.state; } catch {} }
  else { C.tick(store.S, now()); saveLocal(); }
  if (!busy) { ui.keepScroll = true; render(); }
}, 60e3);

// ishga tushirish
applyTheme();
routeFromHash();
await load();
render();
