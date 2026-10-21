// Kontent Zavod worker: navbatdan vaqti kelgan, tayyor postlarni platformaga joylaydi va panelga xabar beradi.
// Ishga tushirish: npm run worker   (bir marta: npm run worker -- --once)
// Haqiqiy joylash uchun panelda "Simulyatsiya" o'chirilgan bo'lsin (Konveyer va API sahifasi).
import fs from 'node:fs';
import path from 'node:path';
import type { PlatformId, QueueItem, State } from '../src/core/types';
import { channel, uploadVideo, videoIdOf, videoStats, youtubeConfigured } from './youtube';
import { buildDigest } from '../src/core/digest';
import { dayStart, localHour } from '../src/core/format';

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
  async instagram() {
    need('IG_USER_ID', 'IG_ACCESS_TOKEN');
    throw new Error('Instagram yuklash hali yozilmagan: media (REELS) → media_publish');
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
  console.log('Ertalabki hisobot yuborildi');
}

/** Bot buyruqlari (getUpdates): /start — chat ID ni aytadi, /hisobot — egasiga hozirgi hisobot. */
let updateOffset = 0;
async function pollBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const updates = await tg<{ update_id: number; message?: { chat: { id: number; type: string }; text?: string } }[]>('getUpdates', { offset: updateOffset, timeout: 0, allowed_updates: ['message'] });
  for (const u of updates) {
    updateOffset = u.update_id + 1;
    const m = u.message;
    if (!m?.text || m.chat.type !== 'private') continue;
    const owner = String(m.chat.id) === process.env.TELEGRAM_OWNER_ID;
    const cmd = m.text.trim().split(/[\s@]/)[0];
    if (owner && (cmd === '/hisobot' || cmd === '/start')) await sendDigest(m.chat.id);
    else if (cmd === '/start') await tg('sendMessage', { chat_id: m.chat.id, text: `Salom! Sizning chat ID: ${m.chat.id}` });
  }
}

async function runOnce() {
  await syncTelegram().catch((e: Error) => console.error(e.message));
  await syncYoutube().catch((e: Error) => console.error(e.message));
  await pollBot().catch((e: Error) => console.error(e.message));
  await dailyDigest().catch((e: Error) => console.error(e.message));
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

console.log(`Worker: ${API} (har ${INTERVAL / 1000} s)`);
await runOnce().catch((e: Error) => console.error(e.message));
if (!ONCE) setInterval(() => runOnce().catch((e: Error) => console.error(e.message)), INTERVAL);
