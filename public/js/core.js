// Kontent Zavod — umumiy yadro: ma'lumot modeli, amallar, analitika, prognoz.
// Server (Node) ham, brauzer (demo rejim) ham shu faylni ishlatadi.

export const HOUR = 3600e3;
export const DAY = 24 * HOUR;
export const TZ_OFFSET = 5 * HOUR; // Asia/Tashkent, yozgi vaqt yo'q

// ---------- vaqt yordamchilari (Toshkent vaqti) ----------
export const local = (ms) => new Date(ms + TZ_OFFSET);
export const localHour = (ms) => local(ms).getUTCHours();
export const localDow = (ms) => (local(ms).getUTCDay() + 6) % 7; // 0 = Dushanba
export const dayStart = (ms) => Math.floor((ms + TZ_OFFSET) / DAY) * DAY - TZ_OFFSET;
export const at = (dayMs, h, m = 0) => dayStart(dayMs) + h * HOUR + m * 60e3;

// ---------- deterministik tasodif ----------
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const gauss = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s));

// ---------- lug'atlar ----------
export const PLATFORMS = [
  { id: 'youtube', name: 'YouTube', short: 'YT' },
  { id: 'instagram', name: 'Instagram', short: 'IG' },
  { id: 'tiktok', name: 'TikTok', short: 'TT' },
  { id: 'telegram', name: 'Telegram', short: 'TG' },
  { id: 'facebook', name: 'Facebook', short: 'FB' },
];
export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);

export const STAGES = [
  { id: 'idea', name: 'G‘oya' },
  { id: 'script', name: 'Ssenariy' },
  { id: 'production', name: 'Suratga olish' },
  { id: 'editing', name: 'Montaj' },
  { id: 'ready', name: 'Tayyor' },
  { id: 'scheduled', name: 'Rejalashtirilgan' },
  { id: 'published', name: 'Joylandi' },
];

export const CHECKLIST = [
  { id: 'script', name: 'Ssenariy yozildi' },
  { id: 'voice', name: 'Ovoz yozildi' },
  { id: 'footage', name: 'Suratga olindi / render' },
  { id: 'edit', name: 'Montaj tugadi' },
  { id: 'thumbnail', name: 'Muqova (thumbnail)' },
  { id: 'subtitles', name: 'Subtitr' },
  { id: 'caption', name: 'Sarlavha, tavsif, hashtag' },
  { id: 'approved', name: 'Yakuniy tasdiq' },
];

export const TOPICS = ['AI vositalari', 'Biznes g‘oyalar', 'Texno yangiliklar', 'Darslik', 'Motivatsiya', 'Hazil'];
export const FORMATS = [
  { id: 'short', name: 'Qisqa (Shorts/Reels)' },
  { id: 'long', name: 'Uzun video' },
];

export const SCRIPT_TEMPLATES = [
  { id: 'problem', name: 'Muammo → Yechim → CTA', hook: 'Siz ham … muammosiga duch kelganmisiz?', body: '1) Muammo nima va nega muhim.\n2) Yechim: qadam-baqadam.\n3) Natija: oldin / keyin.', cta: 'Saqlab qo‘ying va do‘stingizga yuboring.' },
  { id: 'top3', name: 'Top 3 ro‘yxat', hook: '… uchun 3 ta narsa, uchinchisi sizni hayron qoldiradi.', body: '3-o‘rin: …\n2-o‘rin: …\n1-o‘rin: …', cta: 'Qaysi biri yoqdi? Izohda yozing.' },
  { id: 'beforeafter', name: 'Oldin / Keyin', hook: 'Mana bu 30 soniyada qanday o‘zgardi.', body: 'Oldin: …\nNima qildik: …\nKeyin: …', cta: 'To‘liq darslik uchun obuna bo‘ling.' },
  { id: 'story', name: 'Hikoya', hook: 'Kecha shunday voqea bo‘ldi…', body: 'Boshlanish: …\nBurilish: …\nXulosa: …', cta: 'Davomi keyingi videoda — obuna bo‘ling.' },
];

// ---------- platforma modellari (simulyatsiya uchun) ----------
const MODEL = {
  youtube: { short: 5200, long: 12500, tauShort: 30, tauLong: 110, subs: 0.011, peak: 19, peak2: 13, organic: 22, dow: [0.95, 0.95, 1, 1, 1.05, 1.15, 1.2] },
  instagram: { short: 8200, long: 0, tauShort: 20, subs: 0.006, peak: 20, peak2: 12, organic: 15, dow: [1, 1, 1.05, 1, 1.1, 1.15, 1.05] },
  tiktok: { short: 14500, long: 0, tauShort: 14, subs: 0.008, peak: 21, peak2: 17, organic: 30, dow: [0.95, 0.95, 1, 1, 1.15, 1.25, 1.2] },
  telegram: { short: 3100, long: 4200, tauShort: 9, tauLong: 12, subs: 0.004, peak: 9, peak2: 20, organic: 6, dow: [1.1, 1.05, 1.05, 1.05, 1, 0.85, 0.85] },
  facebook: { short: 2300, long: 0, tauShort: 26, subs: 0.003, peak: 13, peak2: 20, organic: 4, dow: [1, 1, 1, 1, 1, 0.95, 0.9] },
};
const TOPIC_FACTOR = { 'AI vositalari': 1.45, 'Biznes g‘oyalar': 1.1, 'Texno yangiliklar': 1.0, Darslik: 0.9, Motivatsiya: 0.78, Hazil: 1.25 };
const hourFactor = (pid, h) => { const m = MODEL[pid]; return 0.5 + 0.75 * Math.max(gauss(h, m.peak, 2.3), gauss(h + 24, m.peak, 2.3)) + 0.3 * gauss(h, m.peak2, 1.8); };

function makeModel(rng, pid, video, publishedAt, trend) {
  const m = MODEL[pid];
  const long = video.format === 'long' && m.long > 0;
  const n = Math.sqrt(-2 * Math.log(rng() + 1e-9)) * Math.cos(2 * Math.PI * rng());
  let V = (long ? m.long : m.short) * hourFactor(pid, localHour(publishedAt)) * m.dow[localDow(publishedAt)] * (TOPIC_FACTOR[video.topic] || 1) * trend * Math.exp(0.5 * n);
  if (video.viral) V *= 6.5;
  const ret = long ? 0.28 + rng() * 0.2 : 0.38 + rng() * 0.42;
  return {
    V: Math.round(V),
    tau: long ? m.tauLong : m.tauShort * (0.8 + rng() * 0.5),
    like: 0.03 + rng() * 0.05 + (ret - 0.4) * 0.03,
    comment: 0.002 + rng() * 0.008,
    share: 0.003 + rng() * 0.015 * (video.topic === 'Hazil' ? 2 : 1),
    save: 0.004 + rng() * 0.02 * (video.topic === 'Darslik' || video.topic === 'AI vositalari' ? 1.6 : 1),
    subs: m.subs * (0.6 + rng() * 0.8) * (long ? 1.8 : 1),
    ret,
    ctr: pid === 'youtube' ? 0.03 + rng() * 0.07 : null,
  };
}

// ---------- seed ma'lumotlar ----------
const TITLES = {
  'AI vositalari': ['ChatGPT bilan 5 daqiqada biznes-reja', 'Bu AI sizning ishingizni bajaradi', 'Sun’iy intellekt 10 soniyada logo chizdi', 'Telefoningizdagi yashirin AI funksiyalar', 'AI bilan ovozni klon qilish: xavfli tomoni', 'Prezentatsiyani AI 1 daqiqada tayyorladi', 'Eng foydali 5 ta bepul AI sayt', 'AI rezyume yozdi — HR nima dedi?', 'Midjourney va bepul muqobillari', 'AI bilan inglizcha gapirishni mashq qilish', 'Claude bilan kod yozish: 0 dan bot'],
  'Biznes g‘oyalar': ['100$ bilan boshlasa bo‘ladigan 3 biznes', 'Toshkentda 1 kunlik startap', 'Do‘kon uchun Telegram bot qanchaga tushadi', 'Uydan turib pul ishlashning 4 yo‘li', 'Freelancega birinchi buyurtma qanday olinadi', 'Kofe-bar ochish: haqiqiy raqamlar', 'Marketpleysda sotish: Uzum vs Wildberries', 'Kichik biznes uchun SMM xatolar'],
  'Texno yangiliklar': ['Yangi iPhone: olish kerakmi?', 'Eng arzon mikrofon testi', 'Bu hafta texnologiyada nima bo‘ldi', '5G O‘zbekistonda: tezlik testi', 'Arzon noutbuk talabalar uchun', 'Xiaomi vs Samsung: kamera bellashuvi', 'Elektromobil quvvatlash: Toshkent tajribasi'],
  Darslik: ['Python’ni 30 kunda o‘rganish rejasi', 'Telefonda kino sifatida video olish', 'Montajda 3 ta tezkor hiyla', 'Video uchun ssenariy yozish formulasi', 'Mobilografiya: yorug‘lik sirlari', 'Excel’da 1 daqiqada hisobot', 'CapCut’da subtitr avtomatik', 'Kanalni 0 dan 10K gacha olib chiqish'],
  Motivatsiya: ['Ertalabki 5 odat hayotni o‘zgartiradi', 'Nega ko‘pchilik 1-yilda taslim bo‘ladi', 'Kitob o‘qishni qanday odat qilish mumkin', '1% qoidasi', 'Telefonga qaramlikdan qutulish', 'Vaqtni boshqarish: 2 daqiqa qoidasi', 'Muvaffaqiyatsizlikdan keyin nima qilish kerak'],
  Hazil: ['Dasturchi va buyurtmachi', 'Online dars vs real hayot', 'Toshkent tirbandligida 1 kun', 'Onam va Wi-Fi paroli', 'Freelancer dushanba kuni', 'Talaba imtihon oldidan', 'Taksichi va navigator', 'Ish suhbatida kutilmagan savol', 'Yangi yil oldidan bozor'],
};
const HASHTAGS = { 'AI vositalari': '#ai #chatgpt #suniyintellekt #texnologiya', 'Biznes g‘oyalar': '#biznes #startap #pul #uzbekistan', 'Texno yangiliklar': '#texno #gadjet #yangiliklar', Darslik: '#darslik #oqish #foydali', Motivatsiya: '#motivatsiya #odatlar #rivojlanish', Hazil: '#hazil #kulgi #toshkent' };

function scriptFor(title, topic, rng) {
  const t = SCRIPT_TEMPLATES[Math.floor(rng() * SCRIPT_TEMPLATES.length)];
  return { template: t.id, hook: `${title}? Birinchi 3 soniyada javob.`, body: t.body.replaceAll('…', topic.toLowerCase() + ' haqida'), cta: t.cta, hashtags: HASHTAGS[topic] || '', description: `${title}. To‘liq ma’lumot tavsifda.` };
}

export function seed(now = Date.now()) {
  const rng = mulberry32(20261020);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const today = dayStart(now);
  const start = today - 90 * DAY;
  const used = {};
  const titleFor = (topic) => {
    const list = TITLES[topic];
    const i = (used[topic] = (used[topic] || 0) + 1) - 1;
    return list[i % list.length] + (i >= list.length ? ` (${Math.floor(i / list.length) + 1}-qism)` : '');
  };
  const topics = TOPICS;
  const videos = [];
  let vid = 1, pidn = 1;
  const newVideo = (o) => {
    const topic = o.topic || pick(topics);
    const title = o.title || titleFor(topic);
    const v = {
      id: 'v' + vid++, title, topic, format: o.format || 'short', duration: o.format === 'long' ? 480 + Math.floor(rng() * 600) : 25 + Math.floor(rng() * 40),
      status: o.status, createdAt: o.createdAt, owner: pick(['Sardor', 'Madina', 'Jasur']),
      checklist: Object.fromEntries(CHECKLIST.map((c) => [c.id, false])), script: scriptFor(title, topic, rng), notes: '', posts: [], viral: !!o.viral,
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
      const format = rng() < 0.15 ? 'long' : 'short';
      const v = newVideo({ status: 'published', format, createdAt: day - (3 + Math.floor(rng() * 6)) * DAY, viral: d === 61 && k === 0 });
      CHECKLIST.forEach((c) => (v.checklist[c.id] = true));
      const plats = format === 'long' ? ['youtube', 'telegram'] : ['tiktok', ...(rng() < 0.9 ? ['instagram'] : []), ...(rng() < 0.8 ? ['youtube'] : []), ...(rng() < 0.4 ? ['facebook'] : []), ...(rng() < 0.3 ? ['telegram'] : [])];
      const baseH = pick(hours);
      const trend = 0.72 + 0.55 * (d / 90);
      for (const p of plats) {
        let t = at(day, Math.min(23, baseH + Math.floor(rng() * 3) - (p === 'telegram' ? 1 : 0)), pick([0, 0, 15, 30, 45]));
        if (t > now - HOUR) t = now - HOUR - Math.floor(rng() * 4) * HOUR;
        const post = { id: 'p' + pidn++, platform: p, scheduledAt: t, publishedAt: t, status: 'published', url: `https://example.com/${p}/${v.id}`, model: makeModel(rng, p, v, t, trend), snapshots: [] };
        v.posts.push(post);
      }
    }
  }
  // bitta muvaffaqiyatsiz yuklash
  const failedVideo = videos.filter((v) => v.format === 'short').at(-3);
  if (failedVideo) {
    failedVideo.posts.push({ id: 'p' + pidn++, platform: 'facebook', scheduledAt: failedVideo.posts[0].publishedAt, publishedAt: null, status: 'failed', error: 'API xatosi 401: kirish tokeni eskirgan', model: null, snapshots: [] });
  }

  // kelajak: rejalashtirilgan videolar
  const plan = [
    { title: 'Claude bilan 1 kunda sayt yasadim', d: 0, h: 20, plats: ['tiktok', 'instagram', 'youtube'], done: 8, topic: 'AI vositalari' },
    { title: 'Oyiga 1000$: kichik biznes hisob-kitobi', d: 1, h: 19, plats: ['tiktok', 'instagram'], done: 8, topic: 'Biznes g‘oyalar' },
    { title: 'Haftalik texno-dayjest #42', d: 1, h: 9, plats: ['telegram'], done: 6, topic: 'Texno yangiliklar' },
    { title: 'Ota-onam AI ishlatsa', d: 2, h: 21, plats: ['tiktok', 'youtube', 'facebook'], done: 5, topic: 'Hazil' },
    { title: 'CapCut to‘liq kurs: 1-dars', d: 3, h: 18, plats: ['youtube', 'telegram'], done: 4, topic: 'Darslik', format: 'long' },
    { title: 'Ovozingizni AI bilan 5 tilga tarjima qiling', d: 4, h: 20, plats: ['tiktok', 'instagram'], done: 3, topic: 'AI vositalari' },
    { title: 'Bir yil har kuni video joyladim — natija', d: 6, h: 21, plats: ['tiktok', 'instagram', 'youtube'], done: 2, topic: 'Motivatsiya' },
    { title: 'Telegram do‘kon: 0 dan birinchi savdogacha', d: 8, h: 19, plats: ['tiktok', 'instagram'], done: 1, topic: 'Biznes g‘oyalar' },
    { title: 'Eng yaxshi budjet smartfon 2026', d: 10, h: 20, plats: ['tiktok', 'youtube'], done: 1, topic: 'Texno yangiliklar' },
  ];
  for (const p of plan) {
    let t = at(today + p.d * DAY, p.h);
    if (t <= now + 2 * HOUR) t = at(today + (p.d + 1) * DAY, p.h);
    const status = p.done === 8 ? 'scheduled' : p.done >= 5 ? 'editing' : p.done >= 3 ? 'production' : 'script';
    const v = newVideo({ status, title: p.title, topic: p.topic, format: p.format, createdAt: now - (2 + Math.floor(rng() * 5)) * DAY });
    CHECKLIST.slice(0, p.done).forEach((c) => (v.checklist[c.id] = true));
    for (const pl of p.plats) v.posts.push({ id: 'p' + pidn++, platform: pl, scheduledAt: t + (pl === 'telegram' ? -HOUR : 0), publishedAt: null, status: 'scheduled', model: null, snapshots: [] });
  }
  // g'oyalar va ssenariylar (sanasiz)
  const ideaTitles = ['AI bilan podkast montaj qilish', 'Toshkentdagi eng arzon coworking', '1 daqiqada Notion sozlash', 'Kontent zavod: jamoa qanday ishlaydi', 'Reels uchun 7 ta kuchli hook', 'Freelancer soliqlari 2026', 'Robot changyutgich: 3 oylik test', 'AI bilan kod review', 'YouTube monetizatsiya O‘zbekistonda', 'Ertalab 5:00 da turish tajribasi', 'Kursdoshim startap ochdi', 'Shahar bo‘ylab 24 soat'];
  let ii = 0;
  [['idea', 6], ['script', 3], ['production', 1], ['editing', 1], ['ready', 1]].forEach(([status, n]) => {
    for (let i = 0; i < n; i++) {
      const v = newVideo({ status, title: ideaTitles[ii++], createdAt: now - Math.floor(rng() * 10) * DAY });
      const done = { idea: 0, script: 1, production: 3, editing: 4, ready: 8 }[status];
      CHECKLIST.slice(0, done).forEach((c) => (v.checklist[c.id] = true));
      if (status === 'idea') v.script = { template: '', hook: '', body: '', cta: '', hashtags: HASHTAGS[v.topic], description: '' };
    }
  });

  const platforms = [
    { id: 'youtube', handle: '@kontentzavod', base: 31800, connected: true, tokenExpiresAt: now + 40 * DAY },
    { id: 'instagram', handle: '@kontentzavod', base: 19600, connected: true, tokenExpiresAt: now + 3 * DAY + 5 * HOUR },
    { id: 'tiktok', handle: '@kontentzavod', base: 42300, connected: true, tokenExpiresAt: now + 25 * DAY },
    { id: 'telegram', handle: 't.me/kontentzavod', base: 9100, connected: true, tokenExpiresAt: null },
    { id: 'facebook', handle: 'fb.com/kontentzavod', base: 6700, connected: false, tokenExpiresAt: now - 2 * DAY },
  ].map((p) => ({ ...p, organicPerDay: MODEL[p.id].organic, since: start }));

  const state = {
    version: 1, seededAt: now, nextId: { v: vid, p: pidn },
    workspace: { name: 'Kontent Zavod', timezone: 'Asia/Tashkent', autoPublish: true },
    goals: { monthlySubs: 9000, monthlyViews: 2500000, weeklyVideos: 7 },
    platforms, videos, activity: [],
  };
  log(state, now - 3 * HOUR, 'publish', 'Avtomatik joylash: oxirgi video TikTok va Instagram’ga chiqdi');
  log(state, now - 5 * HOUR, 'script', 'Madina 2 ta yangi ssenariy qo‘shdi');
  log(state, now - 26 * HOUR, 'warning', 'Facebook tokeni eskirdi — yuklash to‘xtadi');
  log(state, now - 30 * HOUR, 'milestone', 'TikTok 100 000 obunachiga yaqinlashmoqda');
  return tick(state, now);
}

export function log(state, t, type, text) {
  state.activity.unshift({ t, type, text });
  state.activity = state.activity.slice(0, 200);
}

// ---------- vaqt o'tishi: avtomatik joylash va statistika ----------
export function readiness(v) {
  const done = CHECKLIST.filter((c) => v.checklist[c.id]).length;
  return done / CHECKLIST.length;
}

export function tick(state, now = Date.now()) {
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
    const pub = v.posts.filter((p) => p.status === 'published').length;
    if (v.posts.length && pub > 0 && v.posts.every((p) => p.status !== 'scheduled')) v.status = 'published';
  }
  state.updatedAt = now;
  return state;
}

export const pname = (id) => PLATFORMS.find((p) => p.id === id)?.name || id;

// ---------- statistika ----------
export function postStats(p, t) {
  const empty = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, subs: 0, retention: 0, ctr: null };
  if (p.status !== 'published' || !p.publishedAt || t < p.publishedAt) return empty;
  if (p.snapshots?.length) {
    const s = [...p.snapshots].filter((x) => x.t <= t).sort((a, b) => a.t - b.t);
    return s.length ? { ...empty, ...s.at(-1) } : empty;
  }
  const m = p.model;
  if (!m) return empty;
  const age = (t - p.publishedAt) / HOUR;
  const views = Math.round(m.V * (1 - Math.exp(-age / m.tau)));
  return { views, likes: Math.round(views * m.like), comments: Math.round(views * m.comment), shares: Math.round(views * m.share), saves: Math.round(views * m.save), subs: Math.round(views * m.subs), retention: m.ret, ctr: m.ctr };
}

export function videoStats(v, t) {
  const tot = { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, subs: 0, retW: 0 };
  for (const p of v.posts) {
    const s = postStats(p, t);
    tot.views += s.views; tot.likes += s.likes; tot.comments += s.comments; tot.shares += s.shares; tot.saves += s.saves; tot.subs += s.subs; tot.retW += s.retention * s.views;
  }
  tot.retention = tot.views ? tot.retW / tot.views : 0;
  tot.er = tot.views ? (tot.likes + tot.comments + tot.shares + tot.saves) / tot.views : 0;
  return tot;
}

export const allPosts = (state) => state.videos.flatMap((v) => v.posts.map((p) => ({ v, p })));
export const firstPublish = (v) => Math.min(...v.posts.filter((p) => p.publishedAt).map((p) => p.publishedAt), Infinity);

export function followersAt(state, pid, t) {
  const pl = state.platforms.find((p) => p.id === pid);
  if (!pl) return 0;
  let f = pl.base + pl.organicPerDay * Math.max(0, (t - pl.since) / DAY);
  for (const v of state.videos) for (const p of v.posts) if (p.platform === pid) f += postStats(p, t).subs;
  return Math.round(f + (pl.manualDelta || 0));
}

// kunlik qatorlar: [{day, values:{pid: n}}]
export function dailySeries(state, from, to, metric = 'views', platforms = PLATFORM_IDS) {
  const days = [];
  for (let d = dayStart(from); d <= to; d += DAY) days.push({ day: d, values: Object.fromEntries(platforms.map((p) => [p, 0])) });
  for (const { p } of allPosts(state)) {
    if (!platforms.includes(p.platform) || p.status !== 'published' || p.publishedAt > to) continue;
    for (const row of days) {
      const end = Math.min(row.day + DAY, to);
      if (end < p.publishedAt) continue;
      const a = postStats(p, row.day)[metric] || 0, b = postStats(p, end)[metric] || 0;
      row.values[p.platform] += b - a;
    }
  }
  if (metric === 'subs') for (const row of days) for (const pid of platforms) {
    const pl = state.platforms.find((x) => x.id === pid);
    row.values[pid] += pl ? pl.organicPerDay * (Math.min(row.day + DAY, to) - row.day) / DAY : 0;
  }
  for (const row of days) for (const k in row.values) row.values[k] = Math.round(row.values[k]);
  return days;
}

export function kpis(state, now, days, platforms = PLATFORM_IDS) {
  const calc = (from, to) => {
    const views = sumSeries(dailySeries(state, from, to, 'views', platforms));
    const subs = sumSeries(dailySeries(state, from, to, 'subs', platforms));
    let posts = 0, eng = 0, vw = 0;
    for (const { p } of allPosts(state)) {
      if (!platforms.includes(p.platform) || p.status !== 'published') continue;
      if (p.publishedAt >= from && p.publishedAt < to) {
        posts++;
        const s = postStats(p, to);
        eng += s.likes + s.comments + s.shares + s.saves; vw += s.views;
      }
    }
    return { views, subs, posts, er: vw ? eng / vw : 0 };
  };
  const cur = calc(now - days * DAY, now);
  const prev = calc(now - 2 * days * DAY, now - days * DAY);
  return { cur, prev };
}
const sumSeries = (rows) => rows.reduce((s, r) => s + Object.values(r.values).reduce((a, b) => a + b, 0), 0);

// ---------- vaqt slotlari va prognoz ----------
export const SLOTS = [6, 8, 10, 12, 14, 16, 18, 20, 22]; // 2 soatlik bloklar boshlanishi
export const slotOf = (h) => { if (h < 6) return 8; for (let i = SLOTS.length - 1; i >= 0; i--) if (h >= SLOTS[i]) return i; return 0; };

function matured(state, now, filter) {
  return allPosts(state).filter(({ v, p }) => p.status === 'published' && now - p.publishedAt > 3 * DAY && filter(v, p)).map(({ v, p }) => ({ v, p, s: postStats(p, now) }));
}
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quant = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

export function slotMatrix(state, now, platforms = PLATFORM_IDS) {
  const cells = Array.from({ length: 7 }, () => SLOTS.map(() => ({ sum: 0, n: 0 })));
  const rows = matured(state, now, (v, p) => platforms.includes(p.platform));
  // platformalar orasini tenglashtirish uchun platforma medianiga nisbatan
  const med = {};
  for (const pid of platforms) med[pid] = median(rows.filter((r) => r.p.platform === pid).map((r) => r.s.views)) || 1;
  for (const r of rows) {
    const c = cells[localDow(r.p.publishedAt)][slotOf(localHour(r.p.publishedAt))];
    c.sum += r.s.views / med[r.p.platform]; c.n++;
  }
  return cells.map((row) => row.map((c) => (c.n ? { idx: c.sum / c.n, n: c.n } : null)));
}

function factor(rows, key, base) {
  const g = rows.filter((r) => key(r));
  if (!g.length || !base) return { f: 1, n: 0 };
  const raw = median(g.map((r) => r.s.views)) / base;
  return { f: (g.length * raw + 3) / (g.length + 3), n: g.length };
}

export function forecast(state, now, video, platform, when) {
  const rows = matured(state, now, (v, p) => p.platform === platform && (v.format === video.format || MODEL[platform].long === 0));
  const all = rows.length ? rows : matured(state, now, (v, p) => p.platform === platform);
  if (!all.length) return null;
  const recent = all.filter((r) => now - r.p.publishedAt < 45 * DAY);
  const pool = recent.length >= 5 ? recent : all;
  const views = pool.map((r) => r.s.views);
  const base = median(views);
  const fh = factor(all, (r) => slotOf(localHour(r.p.publishedAt)) === slotOf(localHour(when)), median(all.map((r) => r.s.views)));
  const fd = factor(all, (r) => localDow(r.p.publishedAt) === localDow(when), median(all.map((r) => r.s.views)));
  const ft = factor(all, (r) => r.v.topic === video.topic, median(all.map((r) => r.s.views)));
  const mult = fh.f * fd.f * ft.f;
  const subsRate = median(pool.map((r) => (r.s.views ? r.s.subs / r.s.views : 0)));
  const erRate = median(pool.map((r) => (r.s.views ? (r.s.likes + r.s.comments + r.s.shares + r.s.saves) / r.s.views : 0)));
  const mid = base * mult;
  const lo = quant(views, 0.25) / (base || 1) * mid, hi = quant(views, 0.8) / (base || 1) * mid;
  const n = pool.length;
  return { mid: Math.round(mid), lo: Math.round(lo), hi: Math.round(hi), subs: Math.round(mid * subsRate), subsLo: Math.round(lo * subsRate), subsHi: Math.round(hi * subsRate), er: erRate, n, confidence: n >= 20 ? 'yuqori' : n >= 8 ? 'o‘rta' : 'past', factors: { soat: fh.f, kun: fd.f, mavzu: ft.f } };
}

export function bestSlots(state, now, platform, count = 3) {
  const rows = matured(state, now, (v, p) => p.platform === platform);
  if (!rows.length) return [];
  const med = median(rows.map((r) => r.s.views)) || 1;
  const out = [];
  for (let s = 0; s < SLOTS.length; s++) {
    const g = rows.filter((r) => slotOf(localHour(r.p.publishedAt)) === s);
    if (g.length < 3) continue;
    out.push({ slot: s, idx: median(g.map((r) => r.s.views)) / med, n: g.length });
  }
  return out.sort((a, b) => b.idx - a.idx).slice(0, count);
}

export function bestDay(state, now, platform) {
  const rows = matured(state, now, (v, p) => p.platform === platform);
  const med = median(rows.map((r) => r.s.views)) || 1;
  const out = [];
  for (let d = 0; d < 7; d++) {
    const g = rows.filter((r) => localDow(r.p.publishedAt) === d);
    if (g.length >= 3) out.push({ dow: d, idx: median(g.map((r) => r.s.views)) / med, n: g.length });
  }
  return out.sort((a, b) => b.idx - a.idx)[0] || null;
}

export function forecastPost(state, now, v, p) {
  return forecast(state, now, v, p.platform, p.scheduledAt);
}

// ---------- ogohlantirishlar va tavsiyalar ----------
export const DOW_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
export const DOW_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
export const slotLabel = (s) => `${String(SLOTS[s]).padStart(2, '0')}:00–${String((SLOTS[s] + 2) % 24).padStart(2, '0')}:00`;

export function alerts(state, now) {
  const out = [];
  for (const v of state.videos) {
    const r = readiness(v);
    const next = v.posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
    if (next && r < 1) {
      const h = (next.scheduledAt - now) / HOUR;
      if (h < 72) out.push({ level: h < 24 ? 'critical' : 'serious', videoId: v.id, title: `“${v.title}” tayyor emas`, text: `${Math.round(r * 100)}% tayyor, joylashga ${fmtDur(next.scheduledAt - now)} qoldi. Yetishmaydi: ${CHECKLIST.filter((c) => !v.checklist[c.id]).map((c) => c.name.toLowerCase()).join(', ')}.`, t: next.scheduledAt });
    }
    for (const p of v.posts) {
      if (p.status === 'failed' || p.status === 'missed') out.push({ level: 'critical', videoId: v.id, postId: p.id, title: `${pname(p.platform)}: joylanmadi`, text: `“${v.title}” — ${p.error || 'noma’lum xato'}`, t: p.scheduledAt, action: 'retry' });
      if (p.status === 'published' && now - p.publishedAt < 3 * DAY) {
        const s = postStats(p, now);
        const peers = matured(state, now, (vv, pp) => pp.platform === p.platform).map((r) => r.s.views);
        const med = median(peers);
        const expected = med * (1 - Math.exp(-((now - p.publishedAt) / HOUR) / (p.model?.tau || 24)));
        if (med && s.views > expected * 2.5 && s.views > 5000) out.push({ level: 'good', videoId: v.id, title: `${pname(p.platform)}da trendga chiqmoqda`, text: `“${v.title}” — ${fmtNum(s.views)} ko‘rish, odatdagidan ${(s.views / expected).toFixed(1)}× ko‘p. Davomini tezroq tayyorlang.`, t: p.publishedAt });
      }
    }
  }
  for (const pl of state.platforms) {
    if (!pl.connected) out.push({ level: 'critical', platformId: pl.id, title: `${pname(pl.id)} ulanmagan`, text: 'Token eskirgan yoki ulanish uzilgan. Platformalar bo‘limida qayta ulang.', t: pl.tokenExpiresAt || now });
    else if (pl.tokenExpiresAt && pl.tokenExpiresAt - now < 7 * DAY) out.push({ level: 'warning', platformId: pl.id, title: `${pname(pl.id)} tokeni tugayapti`, text: `${fmtDur(pl.tokenExpiresAt - now)} ichida yangilang, aks holda avtomatik joylash to‘xtaydi.`, t: pl.tokenExpiresAt });
  }
  // bo'sh kunlar
  const empty = [];
  for (let d = 1; d <= 7; d++) {
    const ds = dayStart(now) + d * DAY;
    const has = allPosts(state).some(({ p }) => p.status === 'scheduled' && p.scheduledAt >= ds && p.scheduledAt < ds + DAY);
    if (!has) empty.push(ds);
  }
  if (empty.length) out.push({ level: 'warning', title: `Keyingi 7 kunda ${empty.length} ta bo‘sh kun`, text: `${empty.map((d) => fmtDate(d, { day: 'numeric', month: 'short' })).join(', ')} — hech narsa rejalashtirilmagan. Haftalik maqsad: ${state.goals.weeklyVideos} video.`, t: empty[0], action: 'plan' });
  const order = { critical: 0, serious: 1, warning: 2, good: 3 };
  const goods = out.filter((a) => a.level === 'good').sort((a, b) => b.t - a.t).slice(0, 2);
  return out.filter((a) => a.level !== 'good').concat(goods).sort((a, b) => order[a.level] - order[b.level] || a.t - b.t);
}

export function insights(state, now) {
  const out = [];
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
    out.push({ kind: 'topic', text: `“${byTopic[0].t}” mavzusi eng kuchli: median ${fmtNum(byTopic[0].med)} ko‘rish. “${byTopic.at(-1).t}” esa ${Math.round((1 - byTopic.at(-1).med / byTopic[0].med) * 100)}% past — formatini o‘zgartiring yoki kamroq qiling.` });
    const bySubs = [...byTopic].sort((a, b) => b.subs1k - a.subs1k)[0];
    out.push({ kind: 'subs', text: `Obunachi olib keladigan mavzu: “${bySubs.t}” — har 1000 ko‘rishga ${bySubs.subs1k.toFixed(1)} obunachi.` });
  }
  const short = rows.filter((r) => r.v.format === 'short' && r.p.platform === 'youtube');
  const long = rows.filter((r) => r.v.format === 'long' && r.p.platform === 'youtube');
  const rate = (g) => { const v = g.reduce((s, r) => s + r.s.views, 0); return v ? (g.reduce((s, r) => s + r.s.subs, 0) / v) * 1000 : 0; };
  if (short.length >= 3 && long.length >= 3) out.push({ kind: 'format', text: `YouTube’da uzun videolar har 1000 ko‘rishga ${rate(long).toFixed(1)} obunachi beradi, Shorts esa ${rate(short).toFixed(1)}. Haftasiga kamida 1 ta uzun video qo‘ying.` });
  const weak = rows.filter((r) => r.v.format === 'short' && r.s.retention < 0.45 && now - r.p.publishedAt < 30 * DAY);
  if (weak.length) out.push({ kind: 'hook', text: `Oxirgi 30 kunda ${new Set(weak.map((r) => r.v.id)).size} ta qisqa videoda tomosha 45% dan past. Birinchi 2 soniyadagi “hook”ni kuchaytiring: savol yoki natijani boshida ko‘rsating.` });
  const k = kpis(state, now, 7);
  if (k.cur.posts < state.goals.weeklyVideos) out.push({ kind: 'cadence', text: `Bu hafta ${k.cur.posts} ta joylash bo‘ldi, maqsad ${state.goals.weeklyVideos}. Muntazamlik algoritm uchun muhim — bo‘sh kunlarni to‘ldiring.` });
  return out;
}

// ---------- formatlash ----------
export function fmtNum(n) {
  n = Math.round(n || 0);
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
  if (a >= 1e4) return Math.round(n / 1e3) + 'K';
  if (a >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}
export const fmtFull = (n) => Math.round(n || 0).toLocaleString('ru-RU').replace(/ /g, ' ');
const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
export const MONTHS_FULL = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
export function fmtDate(ms, o = {}) {
  const d = local(ms);
  const parts = [];
  if (o.weekday) parts.push(DOW_SHORT[(d.getUTCDay() + 6) % 7] + ',');
  parts.push(d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]);
  if (o.year) parts.push(d.getUTCFullYear());
  return parts.join(' ');
}
export const fmtTime = (ms) => { const d = local(ms); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
export function fmtDur(ms) {
  const neg = ms < 0; ms = Math.abs(ms);
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / 60e3);
  const s = d ? `${d} kun ${h} soat` : h ? `${h} soat ${m} daq` : `${m} daqiqa`;
  return neg ? s + ' oldin' : s;
}
export function relDay(ms, now) {
  const diff = Math.round((dayStart(ms) - dayStart(now)) / DAY);
  if (diff === 0) return 'Bugun';
  if (diff === 1) return 'Ertaga';
  if (diff === -1) return 'Kecha';
  return fmtDate(ms, { weekday: true });
}
export const pct = (x, d = 1) => (x * 100).toFixed(d).replace('.0', '') + '%';

// ---------- amallar (server va demo bir xil) ----------
export function applyAction(state, action, now = Date.now()) {
  const { type, payload: a = {} } = action;
  const V = (id) => { const v = state.videos.find((x) => x.id === id); if (!v) throw new Error('Video topilmadi: ' + id); return v; };
  const P = (id) => { for (const v of state.videos) { const p = v.posts.find((x) => x.id === id); if (p) return { v, p }; } throw new Error('Post topilmadi: ' + id); };
  switch (type) {
    case 'video.create': {
      const v = {
        id: 'v' + state.nextId.v++, title: (a.title || 'Nomsiz video').slice(0, 140), topic: a.topic || TOPICS[0], format: a.format || 'short', duration: Number(a.duration) || 45,
        status: a.status || 'idea', createdAt: now, owner: a.owner || 'Sardor', checklist: Object.fromEntries(CHECKLIST.map((c) => [c.id, false])),
        script: { template: '', hook: a.hook || '', body: '', cta: '', hashtags: '', description: '' }, notes: a.notes || '', posts: [],
      };
      state.videos.push(v);
      log(state, now, 'create', `Yangi g‘oya qo‘shildi: “${v.title}”`);
      return { state, result: v };
    }
    case 'video.update': {
      const v = V(a.id);
      const allowed = ['title', 'topic', 'format', 'duration', 'notes', 'owner', 'status'];
      for (const k of allowed) if (k in a.patch) v[k] = a.patch[k];
      if (a.patch.script) v.script = { ...v.script, ...a.patch.script };
      return { state, result: v };
    }
    case 'video.move': {
      const v = V(a.id);
      const from = v.status; v.status = a.status;
      if (a.status === 'ready' || a.status === 'scheduled') CHECKLIST.forEach((c) => (v.checklist[c.id] = v.checklist[c.id] || a.status === 'ready'));
      log(state, now, 'move', `“${v.title}”: ${stageName(from)} → ${stageName(a.status)}`);
      return { state, result: v };
    }
    case 'video.check': {
      const v = V(a.id);
      v.checklist[a.key] = !!a.value;
      if (readiness(v) >= 1 && ['idea', 'script', 'production', 'editing'].includes(v.status)) {
        v.status = v.posts.some((p) => p.status === 'scheduled') ? 'scheduled' : 'ready';
        log(state, now, 'ready', `“${v.title}” 100% tayyor`);
      }
      return { state, result: v };
    }
    case 'video.delete': {
      const v = V(a.id);
      state.videos = state.videos.filter((x) => x.id !== a.id);
      log(state, now, 'delete', `O‘chirildi: “${v.title}”`);
      return { state, result: null };
    }
    case 'post.schedule': {
      const v = V(a.videoId);
      const when = Number(a.scheduledAt);
      if (!PLATFORM_IDS.includes(a.platform) || !when) throw new Error('Platforma yoki vaqt noto‘g‘ri');
      const p = { id: 'p' + state.nextId.p++, platform: a.platform, scheduledAt: when, publishedAt: null, status: 'scheduled', model: null, snapshots: [] };
      v.posts.push(p);
      if (['ready', 'published'].includes(v.status) || readiness(v) >= 1) v.status = 'scheduled';
      log(state, now, 'schedule', `“${v.title}” → ${pname(a.platform)}, ${fmtDate(when)} ${fmtTime(when)}`);
      return { state, result: p };
    }
    case 'post.reschedule': {
      const { v, p } = P(a.postId);
      p.scheduledAt = Number(a.scheduledAt); p.status = 'scheduled'; p.error = null;
      log(state, now, 'schedule', `“${v.title}” (${pname(p.platform)}) vaqti o‘zgardi: ${fmtDate(p.scheduledAt)} ${fmtTime(p.scheduledAt)}`);
      return { state, result: p };
    }
    case 'post.remove': {
      const { v, p } = P(a.postId);
      v.posts = v.posts.filter((x) => x.id !== p.id);
      if (v.status === 'scheduled' && !v.posts.some((x) => x.status === 'scheduled')) v.status = readiness(v) >= 1 ? 'ready' : 'editing';
      return { state, result: null };
    }
    case 'post.retry': {
      const { v, p } = P(a.postId);
      p.status = 'scheduled'; p.error = null; p.scheduledAt = now + 15 * 60e3;
      if (v.status === 'published') v.status = 'scheduled';
      log(state, now, 'schedule', `Qayta urinish: “${v.title}” → ${pname(p.platform)} (15 daqiqadan so‘ng)`);
      return { state, result: p };
    }
    case 'post.publishNow': {
      const { v, p } = P(a.postId);
      p.scheduledAt = now - 1000;
      CHECKLIST.forEach((c) => (v.checklist[c.id] = true));
      tick(state, now);
      return { state, result: p };
    }
    case 'post.published': { // tashqi ishchi (worker) xabar beradi
      const { v, p } = P(a.postId);
      p.status = 'published'; p.publishedAt = Number(a.publishedAt) || now; p.url = a.url || p.url; p.error = null; p.model = null;
      p.snapshots = p.snapshots || [];
      if (v.posts.every((x) => x.status !== 'scheduled')) v.status = 'published';
      log(state, now, 'publish', `“${v.title}” ${pname(p.platform)}’ga joylandi (worker)`);
      return { state, result: p };
    }
    case 'post.failed': {
      const { v, p } = P(a.postId);
      p.status = 'failed'; p.error = a.error || 'Noma’lum xato';
      log(state, now, 'warning', `${pname(p.platform)} xatosi: “${v.title}” — ${p.error}`);
      return { state, result: p };
    }
    case 'post.stats': { // tashqi statistika (API yoki qo'lda)
      const { p } = P(a.postId);
      const s = a.stats || {};
      const snap = { t: Number(a.t) || now };
      for (const k of ['views', 'likes', 'comments', 'shares', 'saves', 'subs', 'retention', 'ctr']) if (s[k] != null) snap[k] = Number(s[k]);
      if (!p.snapshots?.length && p.model) { // modeldan haqiqiy ma'lumotga o'tish
        p.snapshots = [{ t: p.publishedAt, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, subs: 0, retention: 0 }];
      }
      p.snapshots.push(snap); p.model = null;
      return { state, result: p };
    }
    case 'platform.update': {
      const pl = state.platforms.find((x) => x.id === a.id);
      if (!pl) throw new Error('Platforma topilmadi');
      for (const k of ['handle', 'connected']) if (k in a.patch) pl[k] = a.patch[k];
      if (a.patch.connected) { pl.tokenExpiresAt = now + 60 * DAY; log(state, now, 'connect', `${pname(pl.id)} qayta ulandi`); }
      if (a.patch.followers != null) pl.manualDelta = (pl.manualDelta || 0) + Number(a.patch.followers) - followersAt(state, pl.id, now);
      return { state, result: pl };
    }
    case 'goals.update': state.goals = { ...state.goals, ...sanitizeNums(a) }; return { state, result: state.goals };
    case 'workspace.update': state.workspace = { ...state.workspace, ...a }; return { state, result: state.workspace };
    default: throw new Error('Noma’lum amal: ' + type);
  }
}
const sanitizeNums = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Number(v) || 0]));
export const stageName = (id) => STAGES.find((s) => s.id === id)?.name || id;

export function nextQueue(state, now) {
  return allPosts(state).filter(({ p }) => p.status === 'scheduled').sort((a, b) => a.p.scheduledAt - b.p.scheduledAt).map(({ v, p }) => ({
    postId: p.id, videoId: v.id, title: v.title, platform: p.platform, scheduledAt: p.scheduledAt, ready: readiness(v) >= 1, readiness: readiness(v),
    caption: [v.script?.description, v.script?.hashtags].filter(Boolean).join('\n\n'), dueIn: p.scheduledAt - now,
  }));
}

export function toCSV(state, now) {
  const head = ['video_id', 'sarlavha', 'mavzu', 'format', 'platforma', 'holat', 'joylangan_sana', 'joylangan_vaqt', 'korishlar', 'layklar', 'izohlar', 'ulashishlar', 'saqlashlar', 'yangi_obunachilar', 'tomosha_foizi', 'url'];
  const rows = allPosts(state).map(({ v, p }) => {
    const s = postStats(p, now);
    const t = p.publishedAt || p.scheduledAt;
    return [v.id, v.title, v.topic, v.format, pname(p.platform), p.status, t ? fmtDate(t, { year: true }) : '', t ? fmtTime(t) : '', s.views, s.likes, s.comments, s.shares, s.saves, s.subs, s.retention ? (s.retention * 100).toFixed(1) : '', p.url || ''];
  });
  return [head, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
}
