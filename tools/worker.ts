// Kontent Zavod worker: navbatdan vaqti kelgan, tayyor postlarni platformaga joylaydi va panelga xabar beradi.
// Ishga tushirish: npm run worker   (bir marta: npm run worker -- --once)
// Haqiqiy joylash uchun panelda "Simulyatsiya" o'chirilgan bo'lsin (Konveyer va API sahifasi).
import fs from 'node:fs';
import path from 'node:path';
import type { PlatformId, QueueItem, State } from '../src/core/types';
import { mirrorSoon } from '../server/files';
import { publicMediaPath } from '../server/media';
import { account as igAccount, instagramConfigured, publishReel, refreshToken as igRefresh } from './instagram';
import { channel, extChannel, uploadVideo, videoIdOf, videoStats, youtubeConfigured } from './youtube';
import { buildDigest } from '../src/core/digest';
import { dayStart, localHour } from '../src/core/format';
import { PAY_ASK, PAY_BAD, STATUSES, choiceKeyboard, createdText, label, linkFailed, nxHelp, openTasksText, parseAmount, payText, statusLabel, tr, type Lang, type Me, type NarxtopData, type Order } from '../src/core/narxtop';
import { GIFT_MISSING, LEAD_PROMPT, LEAD_THANKS, OWNER_HELP, PUBLIC_MENU, PUBLIC_WELCOME, SERVICES_TEXT, approvalText, approvedText, awaitingApproval, leadText, nextFreeSlot, planText, postponedText, statsText } from '../src/core/bot';

const API = process.env.PANEL_URL ?? 'http://localhost:4310';
const TOKEN = process.env.ADMIN_TOKEN ?? '';
const MEDIA_DIR = process.env.MEDIA_DIR ?? './media'; // <videoId>.mp4 fayllari
const INTERVAL = Number(process.env.WORKER_INTERVAL ?? 60) * 1000;
const ONCE = process.argv.includes('--once');
// --only p123: faqat shu postni joylash (sinov uchun)
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const headers = { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };
async function api<T>(p: string, body?: unknown): Promise<T> {
  const r = await fetch(API + p, body ? { method: 'POST', headers, body: JSON.stringify(body) } : { headers });
  if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

/** Kerakli .env kalitlari yo'q bo'lsa aniq xabar beradi. */
function need(...keys: string[]) {
  const miss = keys.filter((k) => !process.env[k]);
  if (miss.length) throw new Error(`Sozlanmagan: ${miss.join(', ')} (.env)`);
}

type Adapter = (job: QueueItem, file?: string) => Promise<{ url: string }>;

const adapters: Record<PlatformId, Adapter> = {
  async telegram(job, file) {
    need('TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHANNEL');
    const base = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    const text = `${job.title}\n\n${job.caption}`;
    let res: { ok: boolean; description?: string; result: { message_id: number } };
    if (file) {
      const form = new FormData();
      form.append('chat_id', process.env.TELEGRAM_CHANNEL!);
      form.append('caption', text.slice(0, 1024));
      form.append('video', new Blob([fs.readFileSync(file)]), path.basename(file));
      res = await (await fetch(`${base}/sendVideo`, { method: 'POST', body: form })).json();
    } else {
      res = await (await fetch(`${base}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHANNEL, text }) })).json();
    }
    if (!res.ok) throw new Error(`Telegram: ${res.description}`);
    return { url: `https://t.me/${process.env.TELEGRAM_CHANNEL!.replace('@', '')}/${res.result.message_id}` };
  },
  async youtube(job, file) {
    need('YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN');
    if (!file) throw new Error('Video fayl yuklanmagan (video kartasi → Video fayl)');
    const description = job.caption.replace(job.hashtags, '').trim();
    return { url: await uploadVideo(file, { title: job.title, description, hashtags: job.hashtags, short: job.format === 'short' }) };
  },
  async instagram(job, file) {
    need('IG_USER_ID', 'IG_ACCESS_TOKEN');
    if (!file) throw new Error('Video fayl yuklanmagan (Instagram faqat Reels)');
    const base = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
    if (!base) throw new Error('PUBLIC_URL sozlanmagan: Instagram videoni ochiq havoladan oladi');
    return { url: await publishReel(base + publicMediaPath(job.videoId), job.caption) };
  },
  async tiktok() {
    need('TIKTOK_ACCESS_TOKEN');
    throw new Error('TikTok yuklash hali yozilmagan: Content Posting API (init → upload → publish)');
  },
  async facebook() {
    need('FB_PAGE_ID', 'FB_PAGE_TOKEN');
    throw new Error('Facebook yuklash hali yozilmagan: /{page-id}/videos');
  },
};

/** Telegram kanal obunachilari soni (getChatMemberCount). O'zgarganda yoki har 30 daqiqada panelga yoziladi
 *  (panel ma'lumotlari tozalansa ham son tez tiklanadi). */
let tgFollowers: number | null = null;
let tgSentAt = 0;
async function syncTelegram() {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHANNEL) return;
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getChatMemberCount?chat_id=${encodeURIComponent(process.env.TELEGRAM_CHANNEL)}`;
  const res: { ok: boolean; result?: number; description?: string } = await (await fetch(url)).json();
  if (!res.ok || res.result == null) throw new Error(`Telegram obunachilar: ${res.description}`);
  if (res.result === tgFollowers && Date.now() - tgSentAt < 30 * 60_000) return;
  await api('/api/action', { type: 'platform.update', payload: { id: 'telegram', patch: { followers: res.result } } });
  if (res.result !== tgFollowers) console.log('Telegram obunachilar:', res.result);
  tgFollowers = res.result;
  tgSentAt = Date.now();
}

/** Instagram: token yangilash (haftasiga) va obunachilar, har 30 daqiqada. */
let igSyncedAt = 0;
async function syncInstagram() {
  if (!instagramConfigured() || Date.now() - igSyncedAt < 30 * 60_000) return;
  igSyncedAt = Date.now();
  await igRefresh().catch((e: Error) => console.error('Instagram token:', e.message));
  const a = await igAccount();
  const { state } = await api<{ state: State }>('/api/state');
  const pl = state.platforms.find((p) => p.id === 'instagram');
  await api('/api/action', { type: 'platform.update', payload: { id: 'instagram', patch: { followers: a.followers_count, ...(pl?.connected ? {} : { connected: true }), ...(pl?.handle === '@' + a.username ? {} : { handle: '@' + a.username }) } } });
  console.log(`Instagram: @${a.username}, ${a.followers_count} obunachi`);
}

/** YouTube: kanal obunachilari va joylangan videolar statistikasi, har 30 daqiqada (kvota: ~2 birlik). */
let ytSyncedAt = 0;
async function syncYoutube() {
  if (!youtubeConfigured() || Date.now() - ytSyncedAt < 30 * 60_000) return;
  ytSyncedAt = Date.now();
  const { state } = await api<{ state: State }>('/api/state');
  const ch = await channel();
  const pl = state.platforms.find((p) => p.id === 'youtube');
  await api('/api/action', { type: 'platform.update', payload: { id: 'youtube', patch: { followers: ch.subscribers, ...(pl?.connected ? {} : { connected: true }), ...(pl?.handle ? {} : { handle: ch.handle }) } } });
  const posts = state.videos.flatMap((v) => v.posts).filter((p) => p.platform === 'youtube' && p.status === 'published' && p.url && videoIdOf(p.url));
  if (!posts.length) return console.log(`YouTube: ${ch.title}, ${ch.subscribers} obunachi`);
  const stats = await videoStats(posts.map((p) => videoIdOf(p.url!)!));
  for (const p of posts) {
    const s = stats.get(videoIdOf(p.url!)!);
    const last = p.snapshots.at(-1);
    if (!s || (last && last.views === s.views && last.likes === s.likes && last.comments === s.comments)) continue;
    await api(`/api/posts/${p.id}/stats`, { stats: s });
  }
  console.log(`YouTube: ${ch.subscribers} obunachi, ${posts.length} ta video statistikasi yangilandi`);
}

/** Kuzatiladigan YouTube kanallar: YT_CHANNELS=tinyledger → TINYLEDGER_YT_REFRESH_TOKEN. Zavod ularga joylamaydi,
 *  faqat obunachilar, ko'rishlar va videolar statistikasini panelga yozadi (har 30 daqiqada). */
let chSyncedAt = 0;
async function syncChannels() {
  const keys = (process.env.YT_CHANNELS ?? '').split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
  if (!keys.length || !process.env.YOUTUBE_CLIENT_ID || Date.now() - chSyncedAt < 30 * 60_000) return;
  chSyncedAt = Date.now();
  for (const key of keys) {
    const refresh = process.env[`${key.toUpperCase()}_YT_REFRESH_TOKEN`];
    if (!refresh) { console.error(`YouTube (${key}): ${key.toUpperCase()}_YT_REFRESH_TOKEN yo‘q`); continue; }
    try {
      const c = await extChannel(key, refresh);
      await api('/api/action', { type: 'channel.sync', payload: c });
      console.log(`YouTube ${c.handle}: ${c.subscribers} obunachi, ${c.views} ko‘rish, ${c.videos.length} video`);
    } catch (e) { console.error((e as Error).message); }
  }
}

/** Bot egasiga (TELEGRAM_OWNER_ID) ertalabki hisobot: har kuni DIGEST_HOUR da (Toshkent), bir marta.
 *  Yuborilgan kun DATA_DIR/digest-sent.txt ga yoziladi — server qayta ishga tushsa takror yubormaydi. */
const DIGEST_HOUR = Number(process.env.DIGEST_HOUR ?? 8);
const DIGEST_FILE = path.join(process.env.DATA_DIR ?? './data', 'digest-sent.txt');
async function tg<T>(method: string, body: unknown): Promise<T> {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await r.json()) as { ok: boolean; result: T; description?: string };
  if (!j.ok) throw new Error(`Telegram ${method}: ${j.description}`);
  return j.result;
}
async function sendDigest(chatId: string | number) {
  const { state } = await api<{ state: State }>('/api/state');
  await tg('sendMessage', { chat_id: chatId, text: buildDigest(state, Date.now()), parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
}
async function dailyDigest() {
  const owner = process.env.TELEGRAM_OWNER_ID;
  if (!owner || !process.env.TELEGRAM_BOT_TOKEN) return;
  const now = Date.now(), h = localHour(now), day = String(dayStart(now));
  if (h < DIGEST_HOUR || h >= DIGEST_HOUR + 3) return; // server ertalab o'chiq bo'lsa, kechqurun eski hisobot yubormaydi
  if (fs.existsSync(DIGEST_FILE) && fs.readFileSync(DIGEST_FILE, 'utf8').trim() === day) return;
  await sendDigest(owner);
  fs.mkdirSync(path.dirname(DIGEST_FILE), { recursive: true });
  fs.writeFileSync(DIGEST_FILE, day);
  mirrorSoon(DIGEST_FILE);
  console.log('Ertalabki hisobot yuborildi');
}

// ---------- Telegram bot: egasi uchun boshqaruv, obunachilar uchun menyu va murojaatlar ----------
// Holat DATA_DIR/bot-state.json da: qaysi video tasdiqqa yuborilgan, kim murojaat yozmoqda. Murojaatlar DATA_DIR/leads.jsonl ga ham yoziladi.
const DATA_DIR = process.env.DATA_DIR ?? './data';
const BOT_FILE = path.join(DATA_DIR, 'bot-state.json');
const GIFT_FILE = process.env.GIFT_FILE ?? path.resolve('brand/30-sorov.pdf');
type BotState = { asked: Record<string, true>; leadWait: number[]; nx?: Record<string, { text: string; files: { name: string; fileId: string }[] }>; payWait?: number[]; taskWait?: number[] };
const loadBot = (): BotState => { try { return { asked: {}, leadWait: [], ...JSON.parse(fs.readFileSync(BOT_FILE, 'utf8')) }; } catch { return { asked: {}, leadWait: [] }; } };
const saveBot = (s: BotState) => { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(BOT_FILE, JSON.stringify(s)); mirrorSoon(BOT_FILE); };
const html = (chat_id: number | string, text: string, extra: object = {}) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra });
const mediaOf = (videoId: string) => ['.mp4', '.mov'].map((e) => path.join(MEDIA_DIR, videoId + e)).find((f) => fs.existsSync(f));
async function sendFile(method: 'sendVideo' | 'sendDocument', chat_id: number | string, file: string, caption: string) {
  const form = new FormData();
  form.append('chat_id', String(chat_id));
  form.append('caption', caption.slice(0, 1024));
  form.append(method === 'sendVideo' ? 'video' : 'document', new Blob([fs.readFileSync(file)]), path.basename(file));
  const res = await (await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', body: form })).json();
  if (!res.ok) throw new Error(`Telegram ${method}: ${res.description}`);
}

/** Video/post qaysi platformalarga va soat nechaga: videoli — 20:00 (Telegram + ulangan bo'lsa YouTube), matnli — 13:00 (faqat Telegram). */
function approvalPlan(state: State, videoId: string) {
  const hasMedia = !!mediaOf(videoId);
  const yt = state.platforms.find((p) => p.id === 'youtube')?.connected;
  const platforms: PlatformId[] = hasMedia && yt ? ['telegram', 'youtube'] : ['telegram'];
  return { platforms, slot: nextFreeSlot(state, Date.now(), 'telegram', hasMedia ? 20 : 13) };
}

/** Tayyor (faqat "Yakuniy tasdiq" qolgan) video yoki postni egasiga tugmalar bilan yuboradi — har biri bir marta. */
async function askApprovals(force = false) {
  const owner = process.env.TELEGRAM_OWNER_ID;
  if (!owner || !process.env.TELEGRAM_BOT_TOKEN) return;
  const bs = loadBot();
  if (force) bs.asked = {};
  const { state } = await api<{ state: State }>('/api/state');
  for (const v of awaitingApproval(state)) {
    if (bs.asked[v.id]) continue;
    const { platforms, slot } = approvalPlan(state, v.id);
    const file = mediaOf(v.id);
    if (file) await sendFile('sendVideo', owner, file, v.title);
    await html(owner, approvalText(v, slot, platforms), { reply_markup: { inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: `ok:${v.id}` }, { text: '❌ Hozir emas', callback_data: `no:${v.id}` }]] } });
    bs.asked[v.id] = true;
    saveBot(bs);
    console.log('Tasdiqqa yuborildi:', v.id, v.title);
  }
}

async function approve(videoId: string) {
  const { state } = await api<{ state: State }>('/api/state');
  const v = awaitingApproval(state).find((x) => x.id === videoId);
  if (!v) {
    const title = state.videos.find((x) => x.id === videoId)?.title ?? videoId;
    return `ℹ️ «${title.replace(/[<>&]/g, '')}» allaqachon rejalashtirilgan yoki o‘zgargan — /reja yoki panelni tekshiring.`;
  }
  const { platforms, slot } = approvalPlan(state, videoId);
  await api('/api/action', { type: 'video.check', payload: { id: videoId, key: 'approved', value: true } });
  for (const platform of platforms) await api('/api/action', { type: 'post.schedule', payload: { videoId, platform, scheduledAt: slot } });
  return approvedText(v.title, slot, platforms);
}

type TgUser = { id: number; username?: string; first_name?: string; last_name?: string };
type Update = {
  update_id: number;
  message?: { message_id: number; chat: { id: number; type: string }; from?: TgUser; text?: string; caption?: string; document?: { file_id: string; file_name?: string } };
  callback_query?: { id: string; from: TgUser; data?: string; message?: { message_id: number; chat: { id: number }; text?: string } };
};

let updateOffset = 0;
async function pollBot(timeout = 0) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const OWNER = process.env.TELEGRAM_OWNER_ID;
  const updates = await tg<Update[]>('getUpdates', { offset: updateOffset, timeout, allowed_updates: ['message', 'callback_query'] });
  for (const u of updates) {
    updateOffset = u.update_id + 1;
    try {
      if (u.callback_query) await onCallback(u.callback_query, OWNER);
      else if (u.message) await onMessage(u.message, OWNER);
    } catch (e) { console.error('bot:', (e as Error).message); }
  }
}

async function onCallback(q: NonNullable<Update['callback_query']>, OWNER?: string) {
  const data = q.data ?? '', chat = q.message?.chat.id ?? q.from.id, isOwner = String(q.from.id) === OWNER;
  await tg('answerCallbackQuery', { callback_query_id: q.id });
  if (data.startsWith('nx:')) return nxCallback(q, data);
  if (isOwner && (data.startsWith('ok:') || data.startsWith('no:'))) {
    const id = data.slice(3);
    const result = data.startsWith('ok:') ? await approve(id) : postponedText((await api<{ state: State }>('/api/state')).state.videos.find((v) => v.id === id)?.title ?? id);
    if (q.message) await tg('editMessageReplyMarkup', { chat_id: chat, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
    // asl tasdiq xabariga reply: bir nechta video bo'lsa ham qaysi biri tasdiqlangani ko'rinib turadi
    await html(chat, result, q.message ? { reply_parameters: { message_id: q.message.message_id, allow_sending_without_reply: true } } : {});
    return;
  }
  if (data === 'svc') await html(chat, SERVICES_TEXT, { reply_markup: { inline_keyboard: [[{ text: '✍️ Murojaat qoldirish', callback_data: 'lead' }]] } });
  else if (data === 'gift') {
    if (fs.existsSync(GIFT_FILE)) await sendFile('sendDocument', chat, GIFT_FILE, 'Biznes uchun 30 ta tayyor ChatGPT so‘rovi — PixelMind 🎁');
    else await html(chat, GIFT_MISSING);
  } else if (data === 'lead') {
    const bs = loadBot();
    if (!bs.leadWait.includes(chat)) bs.leadWait.push(chat);
    saveBot(bs);
    await html(chat, LEAD_PROMPT);
  }
}

async function onMessage(m: NonNullable<Update['message']>, OWNER?: string) {
  if (m.chat.type !== 'private') return;
  const isOwner = String(m.chat.id) === OWNER;
  if (await nxMessage(m, isOwner)) return;
  if (!m.text) return;
  const cmd = m.text.trim().split(/[\s@]/)[0];
  if (isOwner) {
    if (cmd === '/hisobot') await sendDigest(m.chat.id);
    else if (cmd === '/reja' || cmd === '/statistika') {
      const { state } = await api<{ state: State }>('/api/state');
      await html(m.chat.id, cmd === '/reja' ? planText(state, Date.now()) : statsText(state, Date.now()));
    } else if (cmd === '/tasdiq') await askApprovals(true);
    else await html(m.chat.id, OWNER_HELP);
    return;
  }
  // obunachi yoki mijoz
  const bs = loadBot();
  if (cmd === '/start' || cmd === '/menu') {
    await html(m.chat.id, PUBLIC_WELCOME, { reply_markup: PUBLIC_MENU });
    return;
  }
  // murojaat: tugmadan keyingi yoki istalgan erkin xabar egasiga yetkaziladi
  const from = m.from ?? { id: m.chat.id };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const leads = path.join(DATA_DIR, 'leads.jsonl');
  fs.appendFileSync(leads, JSON.stringify({ t: Date.now(), id: from.id, username: from.username ?? null, name: [from.first_name, from.last_name].filter(Boolean).join(' '), text: m.text }) + '\n');
  mirrorSoon(leads);
  if (OWNER) await html(OWNER, leadText(from, m.text));
  bs.leadWait = bs.leadWait.filter((c) => c !== m.chat.id);
  saveBot(bs);
  await html(m.chat.id, LEAD_THANKS, { reply_markup: PUBLIC_MENU });
}

async function runOnce() {
  await syncTelegram().catch((e: Error) => console.error(e.message));
  await syncYoutube().catch((e: Error) => console.error(e.message));
  await syncInstagram().catch((e: Error) => console.error(e.message));
  await syncChannels().catch((e: Error) => console.error(e.message));
  if (ONCE) await pollBot().catch((e: Error) => console.error(e.message));
  if (process.env.DIGEST_AUTO === '1') await dailyDigest().catch((e: Error) => console.error(e.message)); // foydalanuvchi so'rovi: avtomatik hisobot yubormasin
  await askApprovals().catch((e: Error) => console.error(e.message));
  const queue = await api<QueueItem[]>('/api/queue');
  const due = queue.filter((j) => j.dueIn <= 0 && (!ONLY || j.postId === ONLY));
  if (!due.length) return console.log(new Date().toISOString(), `navbatda ${queue.length} ta, vaqti kelgani yo‘q`);
  for (const job of due) {
    if (!job.ready) {
      await api(`/api/posts/${job.postId}/failed`, { error: `Video tayyor emas (${Math.round(job.readiness * 100)}%)` });
      continue;
    }
    const file = ['.mp4', '.mov'].map((e) => path.join(MEDIA_DIR, job.videoId + e)).find((f) => fs.existsSync(f));
    try {
      const { url } = await adapters[job.platform](job, file);
      await api(`/api/posts/${job.postId}/published`, { url, publishedAt: Date.now() });
      console.log('✓', job.platform, job.title, url);
    } catch (e) {
      await api(`/api/posts/${job.postId}/failed`, { error: (e as Error).message });
      console.error('✗', job.platform, job.title, (e as Error).message);
    }
  }
}

// ---------- Narxtop: ish beruvchi uchun bot — pastda doimiy tugmalar menyusi ----------
// Tugmalar: vazifa qo'shish, vazifalar (holatni shu yerdan o'zgartirish), to'lovlar, oylik Excel, til, yordam.
const nxUsers = new Map<number, { me: Me | null; t: number }>();
async function nxUser(tgId: number): Promise<Me | null> {
  const hit = nxUsers.get(tgId);
  if (hit && Date.now() - hit.t < 60_000) return hit.me;
  const me = await api<Me | null>(`/api/users/by-tg/${tgId}`);
  nxUsers.set(tgId, { me, t: Date.now() });
  return me;
}
const nxData = () => api<NarxtopData>('/api/narxtop');
const PANEL_PUBLIC = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';
const escB = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dmyB = (t: number | null) => (t ? new Date(t + 5 * 3600_000).toISOString().slice(0, 10).split('-').reverse().join('.') : '—');
const pnameB = (n: string, lang: Lang) => (lang === 'ru' ? n.replace(/^(\d+)-oy$/, '$1-й месяц') : n);

type NxAction = 'add' | 'tasks' | 'pay' | 'report' | 'lang' | 'help';
const BTN: Record<NxAction, [string, string]> = {
  add: ['📝 Vazifa qo‘shish', '📝 Добавить задачу'],
  tasks: ['📋 Vazifalar', '📋 Задачи'],
  pay: ['💰 To‘lovlar', '💰 Оплаты'],
  report: ['📊 Oylik hisobot', '📊 Отчёт за месяц'],
  lang: ['🌐 Til / Язык', '🌐 Til / Язык'],
  help: ['ℹ️ Yordam', 'ℹ️ Помощь'],
};
/** Pastdagi doimiy tugmalar (reply keyboard). */
const nxKeyboard = (lang: Lang) => {
  const b = (a: NxAction) => ({ text: BTN[a][lang === 'ru' ? 1 : 0] });
  return { keyboard: [[b('add'), b('tasks')], [b('pay'), b('report')], [b('lang'), b('help')]], resize_keyboard: true, is_persistent: true };
};
/** Matn tugmalardan birimi? (ikkala tildagi yozuv ham, buyruqlar ham) */
function nxActionOf(text: string): NxAction | null {
  for (const [a, labels] of Object.entries(BTN) as [NxAction, [string, string]][]) if (labels.includes(text)) return a;
  const cmd = text.split(/[\s@]/)[0];
  const CMD: Record<string, NxAction> = { '/vazifa': 'add', '/zadacha': 'add', '/vazifalar': 'tasks', '/zadachi': 'tasks', '/tolov': 'pay', '/oplata': 'pay', '/excel': 'report', '/otchet': 'report', '/til': 'lang', '/yazyk': 'lang', '/yordam': 'help', '/help': 'help' };
  return CMD[cmd] ?? null;
}
const panelBtn = (lang: Lang) => (PANEL_PUBLIC ? [{ text: tr(lang, '🔗 Panelni ochish', '🔗 Открыть панель'), url: `${PANEL_PUBLIC}/#/narxtop` }] : []);

async function nxMenu(chat: number, lang: Lang, name?: string) {
  const hi = name ? tr(lang, `Salom, ${escB(name)}! 👋`, `Здравствуйте, ${escB(name)}! 👋`) : '';
  await html(chat, [hi, nxHelp(lang)].filter(Boolean).join('\n\n'), { reply_markup: nxKeyboard(lang) });
  if (PANEL_PUBLIC) await html(chat, tr(lang, 'Panel saytda ham ochiladi:', 'Панель также доступна на сайте:'), { reply_markup: { inline_keyboard: [panelBtn(lang)] } });
}

async function nxSendReport(chat: number, lang: Lang, period: string) {
  const r = await fetch(API + `/api/narxtop/report.xlsx?period=${period}&lang=${lang}`, { headers });
  if (!r.ok) throw new Error('hisobot: ' + r.status);
  const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? 'narxtop.xlsx');
  const form = new FormData();
  form.append('chat_id', String(chat));
  form.append('caption', tr(lang, '📊 Narxtop hisoboti', '📊 Отчёт NARXTOP'));
  form.append('document', new Blob([await r.arrayBuffer()]), name);
  const res = await (await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`, { method: 'POST', body: form })).json();
  if (!res.ok) throw new Error('sendDocument: ' + res.description);
}

/** Vazifalar: bajarilmaganlari tugma bo'lib chiqadi — bosilsa, karta va holat tugmalari ochiladi. */
async function nxTasks(chat: number, lang: Lang, edit?: number) {
  const d = await nxData();
  const p = [...d.periods].reverse().find((x) => !x.closedAt) ?? d.periods[d.periods.length - 1];
  const os = p ? d.orders.filter((o) => o.periodId === p.id) : [];
  const num = new Map(os.map((o, i) => [o.id, i + 1]));
  const open = os.filter((o) => o.status !== 'done').reverse();
  const text = openTasksText(d, '', lang) + (open.length ? '\n\n' + tr(lang, '👇 Vazifani tanlang — holatini shu yerdan o‘zgartirasiz:', '👇 Выберите задачу — статус можно изменить прямо здесь:') : '');
  type Btn = { text: string; callback_data?: string; url?: string };
  const rows: Btn[][] = open.slice(0, 20).map((o) => [{ text: `${num.get(o.id)}. ${o.title.slice(0, 40)} · ${statusLabel(o.status, lang)}`, callback_data: `nx:o:${o.id}` }]);
  if (PANEL_PUBLIC) rows.push(panelBtn(lang));
  const body = { text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: rows } };
  if (edit) await tg('editMessageText', { chat_id: chat, message_id: edit, ...body }).catch(() => undefined);
  else await tg('sendMessage', { chat_id: chat, ...body });
}

/** Vazifa kartasi: ma'lumot + holat tugmalari. */
async function nxCard(chat: number, lang: Lang, id: number, edit?: number) {
  const d = await nxData();
  const o = d.orders.find((x) => x.id === id);
  if (!o) { await html(chat, tr(lang, 'Vazifa topilmadi.', 'Задача не найдена.')); return; }
  const per = d.periods.find((p) => p.id === o.periodId);
  const L = [`<b>${escB(o.title)}</b>`, '',
    `${tr(lang, 'Holat', 'Статус')}: <b>${statusLabel(o.status, lang)}</b>`,
    `${tr(lang, 'Yo‘nalish', 'Направление')}: ${o.direction ? escB(label(o.direction, lang)) : '—'}`,
    `${tr(lang, 'Uslub', 'Стиль')}: ${o.style ? escB(label(o.style, lang)) : tr(lang, 'kiritilmagan', 'не указан')}`,
    `${tr(lang, 'Oy', 'Месяц')}: ${escB(pnameB(per?.name ?? '', lang))} · ${o.source === 'import' ? tr(lang, 'eski jadvaldan', 'из старой таблицы') : dmyB(o.createdAt)}`];
  if (o.videoUrl) L.push(`🎬 ${escB(o.videoUrl)}`);
  if (o.script) L.push('', `<i>${escB(o.script.slice(0, 400))}${o.script.length > 400 ? '…' : ''}</i>`);
  const st = STATUSES.filter((x) => x.id !== o.status).map((x) => ({ text: statusLabel(x.id, lang), callback_data: `nx:st:${o.id}:${x.id}` }));
  const kb = [st.slice(0, 2), st.slice(2), [{ text: tr(lang, '⬅️ Vazifalar', '⬅️ К задачам'), callback_data: 'nx:tl' }, ...(PANEL_PUBLIC ? [{ text: tr(lang, '🔗 Panelda', '🔗 В панели'), url: `${PANEL_PUBLIC}/#/narxtop?v=${o.id}` }] : [])]];
  const body = { text: L.join('\n'), parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: { inline_keyboard: kb } };
  if (edit) await tg('editMessageText', { chat_id: chat, message_id: edit, ...body }).catch(() => undefined);
  else await tg('sendMessage', { chat_id: chat, ...body });
}

async function nxCreate(chat: number, tgId: number, text: string, files: { name: string; fileId: string }[], replyTo?: number, lang: Lang = 'uz') {
  const o = await api<Order>('/api/narxtop/tg/order', { tgId: String(tgId), text, files });
  const d = await nxData();
  await html(chat, createdText(o, 'direction', lang), { reply_markup: choiceKeyboard('d', o.id, d.directions, lang), ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}) });
}

async function nxAction(a: NxAction, chat: number, lang: Lang, me: Me | null) {
  const bs = loadBot();
  if (a === 'add') {
    bs.taskWait = [...new Set([...(bs.taskWait ?? []), chat])];
    bs.payWait = (bs.payWait ?? []).filter((c) => c !== chat);
    saveBot(bs);
    await html(chat, tr(lang, '📝 Ssenariyni yoki vazifa nomini yuboring — matn yoki fayl (.docx, .pdf). Birinchi qator vazifa nomi bo‘ladi.', '📝 Отправьте сценарий или название задачи — текстом или файлом (.docx, .pdf). Первая строка станет названием задачи.'),
      { reply_markup: { inline_keyboard: [[{ text: tr(lang, '✖️ Bekor qilish', '✖️ Отмена'), callback_data: 'nx:cx' }]] } });
  } else if (a === 'tasks') await nxTasks(chat, lang);
  else if (a === 'pay') await html(chat, payText(await nxData(), lang), { reply_markup: { inline_keyboard: [[{ text: tr(lang, '➕ To‘lov qo‘shish', '➕ Добавить оплату'), callback_data: 'nx:pa' }]] } });
  else if (a === 'report') {
    const d = await nxData();
    const rows = [...d.periods].reverse().slice(0, 6).map((p) => [{ text: `${p.closedAt ? '✓ ' : '● '}${pnameB(p.name, lang)}`, callback_data: `nx:r:${p.id}` }]);
    if (d.periods.length > 1) rows.push([{ text: tr(lang, '📚 Barcha oylar', '📚 Все месяцы'), callback_data: 'nx:r:all' }]);
    await html(chat, tr(lang, '📊 Qaysi oy hisobotini yuboray? (Excel fayl)', '📊 Отчёт за какой месяц прислать? (файл Excel)'), { reply_markup: { inline_keyboard: rows } });
  } else if (a === 'lang') {
    await html(chat, 'Tilni tanlang / Выберите язык:', { reply_markup: { inline_keyboard: [[{ text: '🇺🇿 O‘zbekcha', callback_data: 'nx:l:uz' }, { text: '🇷🇺 Русский', callback_data: 'nx:l:ru' }]] } });
  } else await nxMenu(chat, lang, me?.name);
}

/** true — xabar Narxtop uchun ishlandi. */
async function nxMessage(m: NonNullable<Update['message']>, isOwner: boolean): Promise<boolean> {
  const text = (m.text ?? m.caption ?? '').trim();
  const cmd = text.split(/[\s@]/)[0];
  if (cmd === '/start' && text.includes('link_')) {
    const code = text.split('link_')[1]?.trim();
    const r = await api<{ ok: boolean; me?: Me }>('/api/users/tg-link', { code, tgId: String(m.chat.id) });
    nxUsers.delete(m.chat.id);
    if (!r.ok || !r.me) { await html(m.chat.id, linkFailed('ru')); return true; }
    const ru = r.me.lang === 'ru';
    const commands = [{ command: 'start', description: ru ? 'Меню' : 'Menyu' }, { command: 'vazifa', description: ru ? 'Добавить задачу' : 'Vazifa qo‘shish' }, { command: 'vazifalar', description: ru ? 'Задачи и статусы' : 'Vazifalar va holat' },
      { command: 'tolov', description: ru ? 'Оплаты' : 'To‘lovlar' }, { command: 'excel', description: ru ? 'Отчёт за месяц (Excel)' : 'Oylik hisobot (Excel)' }, { command: 'til', description: 'Til / Язык' }];
    await tg('setMyCommands', { commands: r.me.role === 'admin' ? [...commands, { command: 'reja', description: 'Keyingi 7 kun' }, { command: 'tasdiq', description: 'Tasdiq kutayotganlar' }] : commands, scope: { type: 'chat', chat_id: m.chat.id } }).catch((e: Error) => console.error(e.message));
    await html(m.chat.id, `✅ <b>${tr(r.me.lang, 'Ulandi', 'Подключено')}: ${escB(r.me.name)}</b>`);
    await nxMenu(m.chat.id, r.me.lang);
    return true;
  }
  const me = await nxUser(m.chat.id).catch(() => null);
  if (!me && !isOwner) return false;
  const lang: Lang = me?.lang ?? 'uz';
  if (cmd === '/start' || cmd === '/menu') { await nxMenu(m.chat.id, lang, me?.name); return true; }
  const act = nxActionOf(text);
  // "/tolov 1.5 mln avans" — bir qatorda to'lov
  if (act === 'pay' && cmd.startsWith('/') && text.slice(cmd.length).trim()) {
    const parsed = parseAmount(text.slice(cmd.length).trim());
    if (parsed) { await api('/api/narxtop/tg/payment', { tgId: String(m.chat.id), ...parsed }); await html(m.chat.id, `✅ ${tr(lang, 'To‘lov yozildi', 'Оплата записана')}\n\n${payText(await nxData(), lang)}`); return true; }
  }
  if (act) { await nxAction(act, m.chat.id, lang, me); return true; }
  if (cmd.startsWith('/')) return false; // egasining boshqa buyruqlari (/reja, /tasdiq…)
  const bs = loadBot();
  if (bs.payWait?.includes(m.chat.id)) {
    const parsed = parseAmount(text);
    if (!parsed) { await html(m.chat.id, PAY_BAD(lang)); return true; }
    bs.payWait = bs.payWait.filter((c) => c !== m.chat.id);
    saveBot(bs);
    await api('/api/narxtop/tg/payment', { tgId: String(m.chat.id), ...parsed });
    await html(m.chat.id, `✅ ${tr(lang, 'To‘lov yozildi', 'Оплата записана')}\n\n${payText(await nxData(), lang)}`, { reply_markup: nxKeyboard(lang) });
    return true;
  }
  const files = m.document ? [{ name: m.document.file_name ?? 'ssenariy', fileId: m.document.file_id }] : [];
  if (!text && !files.length) return false;
  const waiting = bs.taskWait?.includes(m.chat.id);
  // Ssenariyga o'xshagan xabar (fayl, bir necha qator yoki uzun matn) darhol vazifa bo'ladi;
  // qisqa xabar ("ok", "rahmat") tasodifan vazifaga aylanmasin — tugma bilan so'raymiz.
  const looksLikeTask = files.length > 0 || text.includes('\n') || text.length >= 40;
  if (waiting || (me?.role === 'client' && looksLikeTask)) {
    if (waiting) { bs.taskWait = bs.taskWait!.filter((c) => c !== m.chat.id); saveBot(bs); }
    await nxCreate(m.chat.id, m.chat.id, text, files, m.message_id, lang);
    return true;
  }
  // tugmasiz yozilgan qisqa xabar yoki egasining xabari: tasodifan vazifa bo'lib ketmasin — so'raymiz
  bs.nx = Object.fromEntries([...Object.entries(bs.nx ?? {}).slice(-19), [String(m.message_id), { text, files }]]);
  saveBot(bs);
  await html(m.chat.id, tr(lang, '📥 Shu xabarni vazifa qilib qo‘shaymi?', '📥 Добавить это сообщение как задачу?'), { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true }, reply_markup: { inline_keyboard: [[{ text: tr(lang, '✅ Ha, qo‘sh', '✅ Да, добавить'), callback_data: `nx:add:${m.message_id}` }, { text: tr(lang, 'Yo‘q', 'Нет'), callback_data: `nx:no:${m.message_id}` }]] } });
  return true;
}

async function nxCallback(q: NonNullable<Update['callback_query']>, data: string) {
  const chat = q.message?.chat.id ?? q.from.id, msg = q.message?.message_id;
  const clear = () => msg && tg('editMessageReplyMarkup', { chat_id: chat, message_id: msg, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
  const [, kind, a, b] = data.split(':');
  const me = await nxUser(q.from.id).catch(() => null);
  const lang: Lang = me?.lang ?? 'uz';
  if (kind === 'l' && (a === 'uz' || a === 'ru')) {
    await api('/api/users/tg-lang', { tgId: String(q.from.id), lang: a });
    nxUsers.delete(q.from.id);
    await clear();
    await nxMenu(chat, a, me?.name);
    return;
  }
  if (kind === 'cx') {
    const bs = loadBot();
    bs.taskWait = (bs.taskWait ?? []).filter((c) => c !== chat);
    bs.payWait = (bs.payWait ?? []).filter((c) => c !== chat);
    saveBot(bs);
    if (msg) await tg('editMessageText', { chat_id: chat, message_id: msg, text: tr(lang, 'Bekor qilindi.', 'Отменено.') }).catch(() => undefined);
    return;
  }
  if (kind === 'r') { await nxSendReport(chat, lang, a); return; }
  if (kind === 'tl') { await nxTasks(chat, lang, msg); return; }
  if (kind === 'o') { await nxCard(chat, lang, Number(a), msg); return; }
  if (kind === 'st') {
    await api(`/api/narxtop/tg/order/${a}`, { tgId: String(q.from.id), status: b });
    await nxCard(chat, lang, Number(a), msg);
    return;
  }
  if (kind === 'pa') {
    const bs = loadBot();
    bs.payWait = [...new Set([...(bs.payWait ?? []), chat])];
    bs.taskWait = (bs.taskWait ?? []).filter((c) => c !== chat);
    saveBot(bs);
    await html(chat, PAY_ASK(lang), { reply_markup: { inline_keyboard: [[{ text: tr(lang, '✖️ Bekor qilish', '✖️ Отмена'), callback_data: 'nx:cx' }]] } });
    return;
  }
  if (kind === 'pc') {
    await api(`/api/narxtop/tg/payment/${a}/confirm`, { tgId: String(q.from.id) });
    await clear();
    if (msg) await html(chat, '✅ Tasdiqlandi — ish beruvchiga xabar yuborildi.', { reply_parameters: { message_id: msg, allow_sending_without_reply: true } });
    return;
  }
  if (kind === 'add' || kind === 'no') {
    const bs = loadBot();
    const item = bs.nx?.[a];
    if (bs.nx) delete bs.nx[a];
    saveBot(bs);
    if (kind === 'no' || !item) { await clear(); if (msg) await tg('editMessageText', { chat_id: chat, message_id: msg, text: kind === 'no' ? tr(lang, 'Qo‘shilmadi.', 'Не добавлено.') : tr(lang, 'Xabar topilmadi, qayta yuboring.', 'Сообщение не найдено, отправьте ещё раз.') }); return; }
    if (msg) await tg('deleteMessage', { chat_id: chat, message_id: msg }).catch(() => undefined);
    await nxCreate(chat, q.from.id, item.text, item.files, Number(a), lang);
    return;
  }
  if (kind !== 'd' && kind !== 's') return;
  const d = await nxData();
  const list = kind === 'd' ? d.directions : d.styles;
  const idx = Number(b);
  const o = idx >= 0 ? await api<Order>(`/api/narxtop/tg/order/${a}`, { tgId: String(q.from.id), [kind === 'd' ? 'direction' : 'style']: list[idx] }) : d.orders.find((x) => x.id === Number(a));
  if (!o || !msg) return;
  const next = kind === 'd' ? 'style' : 'done';
  await tg('editMessageText', { chat_id: chat, message_id: msg, text: createdText(o, next, lang), parse_mode: 'HTML', reply_markup: next === 'style' ? choiceKeyboard('s', o.id, d.styles, lang) : { inline_keyboard: [] } });
}

console.log(`Worker: ${API} (har ${INTERVAL / 1000} s)`);
// Bot alohida aylanishda: getUpdates 25 soniya kutib turadi, xabar kelishi bilan javob beradi.
if (!ONCE && process.env.TELEGRAM_BOT_TOKEN) void (async () => {
  for (;;) {
    await pollBot(25).catch(async (e: Error) => { console.error('bot:', e.message); await new Promise((ok) => setTimeout(ok, 5000)); });
  }
})();
// Keyingi aylanish oldingisi tugagandan keyin: Instagram/YouTube yuklash bir daqiqadan uzoq cho'zilsa,
// setInterval bir postni ikki marta joylab yuborardi.
for (;;) {
  await runOnce().catch((e: Error) => console.error(e.message));
  if (ONCE) break;
  await new Promise((ok) => setTimeout(ok, INTERVAL));
}
