// Botni haqiqiy Telegram'siz sinash: vaqtinchalik baza, soxta bot tokeni, soxta fetch (panel API jarayon ichida, Telegram — yozib olinadi).
// Ishga tushirish: npx tsx tools/sim-bot.ts   (.env o'qilmaydi; production va haqiqiy bot tokeniga tegmaydi)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kz-sim-'));
const ADMIN = 'sim-admin-token-0123456789';
for (const k of Object.keys(process.env)) if (/^(TELEGRAM_|YOUTUBE_|YT_|INSTAGRAM_|IG_|DATABASE_|TINYLEDGER_)/.test(k)) delete process.env[k];
Object.assign(process.env, {
  DATA_DIR: DIR, ADMIN_TOKEN: ADMIN, TELEGRAM_BOT_TOKEN: '123456:SIM-fake-token', TELEGRAM_API_URL: 'http://tg.sim', SEED: 'empty',
  PANEL_URL: 'http://panel.sim', PUBLIC_URL: 'https://panel.example', SESSION_SECRET: 'sim',
});

const { app } = await import('../server/app');
const TG_USER = 777001;
const calls: { method: string; body: Record<string, unknown> }[] = [];
let updates: unknown[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  const u = String(url instanceof Request ? url.url : url);
  if (u.startsWith('http://panel.sim')) return app.request(u.slice('http://panel.sim'.length), init);
  if (u.startsWith('http://tg.sim/')) {
    const method = u.split('/').pop()!.split('?')[0];
    const body = init?.body instanceof FormData ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '<fayl>'])) : init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ method, body });
    const result = method === 'getUpdates' ? updates.splice(0) : method === 'getMe' ? { username: 'SimBot' } : { message_id: calls.length };
    return new Response(JSON.stringify({ ok: true, result }), { headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('sim: tashqi so‘rov taqiqlangan: ' + u);
}) as typeof fetch;
void realFetch;

const api = async (p: string, body?: unknown, token = ADMIN) => {
  const r = await app.request('/api' + p, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json() as Promise<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
};
await api('/users', { login: 'ishchi', name: 'Ish beruvchi', role: 'client', password: 'sim-parol-123' });
const tok = (await (await app.request('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'ishchi', password: 'sim-parol-123' }) })).json()).token;
const { code } = await api('/me/telegram', {}, tok);
const order = await api('/narxtop/orders', { title: 'Sim vazifa', direction: 'Internet' }, tok);

const chat = { id: TG_USER, type: 'private' }, from = { id: TG_USER, first_name: 'Ish' };
let uid = 1;
const msg = (text: string) => ({ update_id: uid++, message: { message_id: uid, chat, from, date: 0, text } });
const cb = (data: string) => ({ update_id: uid++, callback_query: { id: 'q' + uid, from, data, message: { message_id: 50, chat } } });
updates = [msg(`/start link_${code}`), msg('/start'), msg('📋 Задачи'), cb(`nx:o:${order.id}`), cb('nx:r:all')];

process.argv.push('--once');
await import('./worker');

// ---------- natija ----------
const show = (c: { method: string; body: Record<string, unknown> }) => {
  const kb = (c.body.reply_markup as { inline_keyboard?: { text: string; url?: string; web_app?: { url: string } }[][] } | undefined)?.inline_keyboard?.flat().filter((b) => b.url || b.web_app);
  return `${c.method.padEnd(18)} ${String(c.body.text ?? c.body.caption ?? JSON.stringify(c.body.menu_button ?? '')).split('\n')[0].slice(0, 70)}${kb?.length ? '\n' + kb.map((b) => `    ↳ [${b.text}] ${b.web_app ? 'web_app ' + b.web_app.url : 'url ' + b.url}`).join('\n') : ''}`;
};
console.log('\n--- Telegram so‘rovlari ---');
for (const c of calls.filter((x) => x.method !== 'getUpdates' && x.method !== 'answerCallbackQuery')) console.log(show(c));
const menu = calls.filter((c) => c.method === 'setChatMenuButton');
const webApps = calls.flatMap((c) => ((c.body.reply_markup as { inline_keyboard?: { web_app?: { url: string } }[][] })?.inline_keyboard ?? []).flat()).filter((b) => b.web_app);
const doc = calls.find((c) => c.method === 'sendDocument');
const ok = menu.length >= 2 && menu.every((m) => (m.body.menu_button as { type: string }).type === 'web_app') && webApps.length >= 3 && webApps.some((b) => b.web_app!.url.endsWith(`/#/narxtop?v=${order.id}`)) && doc?.body.chat_id === String(TG_USER);
console.log(`\nsetChatMenuButton: ${menu.length}, web_app tugmalari: ${webApps.length}, Excel yuborildi: ${!!doc}`);
console.log(ok ? 'SIM: OK' : 'SIM: XATO');
try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* band */ }
process.exit(ok ? 0 : 1);
