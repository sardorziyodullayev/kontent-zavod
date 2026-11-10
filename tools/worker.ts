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
import { LINK_FAILED, NX_HELP, choiceKeyboard, createdText, linkedText, openTasksText, type Me, type NarxtopData, type Order } from '../src/core/narxtop';
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
type BotState = { asked: Record<string, true>; leadWait: number[]; nx?: Record<string, { text: string; files: { name: string; fileId: string }[] }> };
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
    if (cmd === '/hisobot' || cmd === '/start') await sendDigest(m.chat.id);
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
  await dailyDigest().catch((e: Error) => console.error(e.message));
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

// ---------- Narxtop: ish beruvchi ssenariyni botga yuboradi → panelda vazifa ----------
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

async function nxSendReport(chat: number) {
  const r = await fetch(API + '/api/narxtop/report.xlsx', { headers });
  if (!r.ok) throw new Error('hisobot: ' + r.status);
  const name = decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? 'narxtop-hisobot.xlsx');
  const form = new FormData();
  form.append('chat_id', String(chat));
  form.append('caption', '📊 Narxtop hisoboti (joriy oy)');
  form.append('document', new Blob([await r.arrayBuffer()]), name);
  const res = await (await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendDocument`, { method: 'POST', body: form })).json();
  if (!res.ok) throw new Error('sendDocument: ' + res.description);
}

async function nxCreate(chat: number, tgId: number, text: string, files: { name: string; fileId: string }[], replyTo?: number) {
  const o = await api<Order>('/api/narxtop/tg/order', { tgId: String(tgId), text, files });
  const d = await nxData();
  await html(chat, createdText(o, 'direction'), { reply_markup: choiceKeyboard('d', o.id, d.directions), ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}) });
}

/** true — xabar Narxtop uchun ishlandi. Ulangan foydalanuvchi (mijoz) matni darhol vazifa bo'ladi; egasidan esa so'raladi. */
async function nxMessage(m: NonNullable<Update['message']>, isOwner: boolean): Promise<boolean> {
  const text = (m.text ?? m.caption ?? '').trim();
  const cmd = text.split(/[\s@]/)[0];
  if (cmd === '/start' && text.includes('link_')) {
    const code = text.split('link_')[1]?.trim();
    const r = await api<{ ok: boolean; me?: Me }>('/api/users/tg-link', { code, tgId: String(m.chat.id) });
    nxUsers.delete(m.chat.id);
    await html(m.chat.id, r.ok && r.me ? linkedText(r.me.name) : LINK_FAILED);
    // shu chat uchun buyruqlar menyusi ("/" tugmasi): ish beruvchiga faqat Narxtop buyruqlari
    if (r.ok && r.me) {
      const nx = [{ command: 'vazifalar', description: 'Bajarilmagan vazifalar' }, { command: 'excel', description: 'Joriy oy hisoboti (Excel)' }];
      const commands = r.me.role === 'client' ? [...nx, { command: 'yordam', description: 'Bot qanday ishlaydi' }]
        : [{ command: 'hisobot', description: 'Kunlik hisobot' }, { command: 'reja', description: 'Keyingi 7 kun' }, ...nx, { command: 'statistika', description: 'Obunachilar' }, { command: 'tasdiq', description: 'Tasdiq kutayotganlar' }];
      await tg('setMyCommands', { commands, scope: { type: 'chat', chat_id: m.chat.id } }).catch((e: Error) => console.error(e.message));
    }
    return true;
  }
  const me = await nxUser(m.chat.id).catch(() => null);
  if (!me && !isOwner) return false;
  if (cmd === '/vazifalar') { await html(m.chat.id, openTasksText(await nxData(), PANEL_PUBLIC)); return true; }
  if (cmd === '/excel' || (!isOwner && cmd === '/hisobot')) { await nxSendReport(m.chat.id); return true; }
  if (!isOwner && (cmd === '/start' || cmd === '/yordam' || cmd === '/help')) { await html(m.chat.id, NX_HELP); return true; }
  if (cmd.startsWith('/')) return false; // egasining boshqa buyruqlari
  const files = m.document ? [{ name: m.document.file_name ?? 'ssenariy', fileId: m.document.file_id }] : [];
  if (!text && !files.length) return false;
  if (me?.role === 'client') { await nxCreate(m.chat.id, m.chat.id, text, files, m.message_id); return true; }
  // egasi (admin): tasodifiy xabar vazifa bo'lib ketmasin — tugma bilan so'raymiz
  const bs = loadBot();
  bs.nx = Object.fromEntries([...Object.entries(bs.nx ?? {}).slice(-19), [String(m.message_id), { text, files }]]);
  saveBot(bs);
  await html(m.chat.id, '📥 Shu xabarni Narxtop vazifasi qilib qo‘shaymi?', { reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true }, reply_markup: { inline_keyboard: [[{ text: '✅ Ha, qo‘sh', callback_data: `nx:add:${m.message_id}` }, { text: 'Yo‘q', callback_data: `nx:no:${m.message_id}` }]] } });
  return true;
}

async function nxCallback(q: NonNullable<Update['callback_query']>, data: string) {
  const chat = q.message?.chat.id ?? q.from.id, msg = q.message?.message_id;
  const clear = () => msg && tg('editMessageReplyMarkup', { chat_id: chat, message_id: msg, reply_markup: { inline_keyboard: [] } });
  const [, kind, a, b] = data.split(':');
  if (kind === 'add' || kind === 'no') {
    const bs = loadBot();
    const item = bs.nx?.[a];
    if (bs.nx) delete bs.nx[a];
    saveBot(bs);
    if (kind === 'no' || !item) { await clear(); if (msg) await tg('editMessageText', { chat_id: chat, message_id: msg, text: kind === 'no' ? 'Qo‘shilmadi.' : 'Xabar topilmadi, qayta yuboring.' }); return; }
    if (msg) await tg('deleteMessage', { chat_id: chat, message_id: msg }).catch(() => undefined);
    await nxCreate(chat, q.from.id, item.text, item.files, Number(a));
    return;
  }
  if (kind !== 'd' && kind !== 's') return;
  const d = await nxData();
  const list = kind === 'd' ? d.directions : d.styles;
  const idx = Number(b);
  const o = idx >= 0 ? await api<Order>(`/api/narxtop/tg/order/${a}`, { tgId: String(q.from.id), [kind === 'd' ? 'direction' : 'style']: list[idx] }) : d.orders.find((x) => x.id === Number(a));
  if (!o || !msg) return;
  const next = kind === 'd' ? 'style' : 'done';
  await tg('editMessageText', { chat_id: chat, message_id: msg, text: createdText(o, next), parse_mode: 'HTML', reply_markup: next === 'style' ? choiceKeyboard('s', o.id, d.styles) : { inline_keyboard: [] } });
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
