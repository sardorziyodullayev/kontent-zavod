// API testlari: kirish, rollar, arxiv, to'lovlar, mustChange va Telegram Mini App kirishi.
// Vaqtinchalik DATA_DIR (bo'sh baza), soxta bot tokeni va soxta fetch — haqiqiy Telegram va production'ga tegilmaydi.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { signWebAppInit } from '../server/telegram';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kz-api-'));
const ADMIN = 'sinov-admin-token-0123456789';
const BOT = '123456:TEST-fake-token';
Object.assign(process.env, { DATA_DIR: DIR, ADMIN_TOKEN: ADMIN, TELEGRAM_BOT_TOKEN: BOT, TELEGRAM_API_URL: 'http://tg.invalid', SEED: 'empty', SESSION_SECRET: 'sinov-secret' });
delete process.env.DATABASE_URL;
delete process.env.TELEGRAM_OWNER_ID;
delete process.env.PUBLIC_URL;
delete process.env.RENDER_EXTERNAL_URL;

// Telegram'ga ketadigan so'rovlar shu yerda ushlanadi
const tgCalls: { method: string; body: unknown }[] = [];
vi.stubGlobal('fetch', async (url: string | URL, init?: RequestInit) => {
  const u = String(url);
  if (!u.startsWith('http://tg.invalid/')) throw new Error('kutilmagan tarmoq so‘rovi: ' + u);
  const method = u.split('/').pop()!.split('?')[0];
  const body = init?.body instanceof FormData ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : `<fayl ${(v as File).size} bayt>`])) : init?.body ? JSON.parse(String(init.body)) : null;
  tgCalls.push({ method, body });
  return new Response(JSON.stringify({ ok: true, result: method === 'getMe' ? { username: 'SinovBot' } : { message_id: 1 } }), { headers: { 'Content-Type': 'application/json' } });
});

let app: { request: (p: string, init?: RequestInit) => Response | Promise<Response> };
beforeAll(async () => { ({ app } = await import('../server/app')); }, 120_000);
afterAll(() => { try { fs.rmSync(DIR, { recursive: true, force: true }); } catch { /* Windows: baza fayli band bo'lishi mumkin */ } });

type Opt = { token?: string; body?: unknown; method?: string; ip?: string; lang?: string };
async function call(p: string, o: Opt = {}) {
  const headers: Record<string, string> = { 'x-forwarded-for': o.ip ?? '10.0.0.1' };
  if (o.token) headers.Authorization = `Bearer ${o.token}`;
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  if (o.lang) headers['X-Lang'] = o.lang;
  const r = await app.request('/api' + p, { method: o.method ?? (o.body !== undefined ? 'POST' : 'GET'), headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
  const text = await r.text();
  let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
  try { json = JSON.parse(text); } catch { /* fayl */ }
  return { status: r.status, json, headers: r.headers };
}
const login = async (l: string, p: string) => (await call('/auth/login', { body: { login: l, password: p }, ip: '10.9.9.9' })).json.token as string;

let adminTok = '', clientTok = '';
const CLIENT_PW = 'vaqtinchalik-1', CLIENT_PW2 = 'yangi-parol-22';

describe('kirish va foydalanuvchilar', () => {
  it('health ochiq, qolgani kirishni talab qiladi', async () => {
    expect((await call('/health')).status).toBe(200);
    expect((await call('/state')).status).toBe(401);
    expect((await call('/narxtop')).status).toBe(401);
    expect((await call('/state', { token: 'u.1.0.9999999999999.soxta' })).status).toBe(401);
  });

  it('admin token bilan foydalanuvchi yaratish; qisqa parol rad etiladi', async () => {
    expect((await call('/users', { token: ADMIN, body: { login: 'sardor', name: 'Sardor', role: 'admin', password: 'qisqa' } })).status).toBe(400);
    expect((await call('/users', { token: ADMIN, body: { login: 'sardor', name: 'Sardor', role: 'admin', password: 'admin-parol-1' } })).status).toBe(201);
    const c = await call('/users', { token: ADMIN, body: { login: 'ishchi', name: 'Ish beruvchi', role: 'client', password: CLIENT_PW } });
    expect(c.status).toBe(201);
    expect(c.json).toMatchObject({ role: 'client', lang: 'ru', mustChange: true });
    expect((await call('/users', { token: ADMIN, body: { login: 'ishchi', password: 'boshqa-parol-1' } })).status).toBe(400); // band
  });

  it('login: to‘g‘ri parol — token, xato parol — 401 (rus tilida xato matni)', async () => {
    const ok = await call('/auth/login', { body: { login: 'Sardor ', password: 'admin-parol-1' } });
    expect(ok.status).toBe(200);
    expect(ok.json.me).toMatchObject({ login: 'sardor', role: 'admin' });
    adminTok = ok.json.token;
    const bad = await call('/auth/login', { body: { login: 'sardor', password: 'notogri-parol' }, lang: 'ru' });
    expect(bad.status).toBe(401);
    expect(bad.json.error).toBe('Неверный логин или пароль');
  });

  it('10 ta xato urinishdan keyin 429 (IP bo‘yicha), boshqa IP dan to‘g‘ri parol ishlaydi', async () => {
    for (let i = 0; i < 10; i++) expect((await call('/auth/login', { body: { login: `yoq${i}`, password: 'x' }, ip: '10.6.6.6' })).status).toBe(401);
    expect((await call('/auth/login', { body: { login: 'sardor', password: 'admin-parol-1' }, ip: '10.6.6.6' })).status).toBe(429);
    expect((await call('/auth/login', { body: { login: 'sardor', password: 'admin-parol-1' }, ip: '10.7.7.7' })).status).toBe(200);
  });

  it('10 ta xato urinishdan keyin 429 (login bo‘yicha, IP almashtirilsa ham)', async () => {
    await call('/users', { token: ADMIN, body: { login: 'nishon', password: 'nishon-parol-1' } });
    for (let i = 0; i < 10; i++) await call('/auth/login', { body: { login: 'nishon', password: 'xato' }, ip: `10.8.0.${i}` });
    expect((await call('/auth/login', { body: { login: 'nishon', password: 'nishon-parol-1' }, ip: '10.8.1.1' })).status).toBe(429);
  });
});

describe('mustChange oqimi', () => {
  it('vaqtinchalik parol bilan kirgan mijoz parolni almashtiradi; eski token bekor bo‘ladi', async () => {
    const t = await login('ishchi', CLIENT_PW);
    expect((await call('/me', { token: t })).json.mustChange).toBe(true);
    expect((await call('/me/password', { token: t, body: { old: 'xato', password: CLIENT_PW2 } })).status).toBe(400);
    expect((await call('/me/password', { token: t, body: { old: CLIENT_PW, password: CLIENT_PW } })).status).toBe(400); // bir xil
    const r = await call('/me/password', { token: t, body: { old: CLIENT_PW, password: CLIENT_PW2 } });
    expect(r.status).toBe(200);
    expect((await call('/me', { token: t })).status).toBe(401); // eski sessiya
    clientTok = r.json.token;
    expect((await call('/me', { token: clientTok })).json).toMatchObject({ mustChange: false, role: 'client', via: 'session' });
    expect((await call('/auth/login', { body: { login: 'ishchi', password: CLIENT_PW }, ip: '10.9.9.8' })).status).toBe(401);
  });

  it('admin mijoz parolini almashtirsa — yana vaqtinchalik (mustChange)', async () => {
    const list = (await call('/users', { token: adminTok })).json as { id: number; login: string }[];
    const id = list.find((u) => u.login === 'nishon')!.id;
    expect((await call(`/users/${id}`, { token: adminTok, method: 'PATCH', body: { password: 'tiklangan-parol-1' } })).status).toBe(200);
    const users = (await call('/users', { token: adminTok })).json as { login: string; mustChange: boolean }[];
    expect(users.find((u) => u.login === 'nishon')!.mustChange).toBe(true);
  });
});

describe('rollar', () => {
  it('mijoz /api/state, /api/users va adminga oid yo‘llarga kira olmaydi', async () => {
    expect((await call('/state', { token: clientTok })).status).toBe(403);
    expect((await call('/users', { token: clientTok })).status).toBe(403);
    expect((await call('/action', { token: clientTok, body: { type: 'goals.update', payload: {} } })).status).toBe(403);
    expect((await call('/narxtop/backup.json', { token: clientTok })).status).toBe(403);
    expect((await call('/narxtop', { token: clientTok })).status).toBe(200);
    expect((await call('/state', { token: adminTok })).status).toBe(200);
  });
});

describe('vazifalar: arxiv va tiklash', () => {
  let id = 0;
  it('mijoz vazifa qo‘shadi, arxivga oladi, tiklaydi; butunlay o‘chirish faqat admin', async () => {
    const o = await call('/narxtop/orders', { token: clientTok, body: { title: 'Sinov video', direction: 'Internet' } });
    expect(o.status).toBe(201);
    id = o.json.id;
    expect((await call(`/narxtop/orders/${id}`, { token: clientTok, method: 'DELETE' })).status).toBe(200);
    let d = (await call('/narxtop', { token: clientTok })).json;
    expect(d.orders.some((x: { id: number }) => x.id === id)).toBe(false);
    expect(d.archived.some((x: { id: number }) => x.id === id)).toBe(true);
    expect((await call(`/narxtop/orders/${id}/restore`, { token: clientTok, body: {} })).status).toBe(200);
    d = (await call('/narxtop', { token: clientTok })).json;
    expect(d.orders.find((x: { id: number }) => x.id === id)?.log.map((l: { text: string }) => l.text)).toEqual(expect.arrayContaining(['Arxivga olindi', 'Arxivdan tiklandi']));
    expect((await call(`/narxtop/orders/${id}?hard=1`, { token: clientTok, method: 'DELETE' })).status).toBe(403);
    expect((await call(`/narxtop/orders/${id}?hard=1`, { token: adminTok, method: 'DELETE' })).status).toBe(200);
    expect((await call('/narxtop', { token: adminTok })).json.archived.some((x: { id: number }) => x.id === id)).toBe(false);
  });
});

describe('to‘lovlar', () => {
  it('mijoz tasdiqlanmagan o‘z to‘lovini o‘chira oladi, tasdiqlanganini — yo‘q; tasdiqlash faqat admin', async () => {
    const p1 = (await call('/narxtop/payments', { token: clientTok, body: { amount: '1 000 000' } })).json;
    expect(p1.confirmedAt).toBeNull();
    expect((await call(`/narxtop/payments/${p1.id}`, { token: clientTok, method: 'DELETE' })).status).toBe(200);
    const p2 = (await call('/narxtop/payments', { token: clientTok, body: { amount: 500000, note: 'avans' } })).json;
    expect((await call(`/narxtop/payments/${p2.id}/confirm`, { token: clientTok, body: {} })).status).toBe(403);
    expect((await call(`/narxtop/payments/${p2.id}/confirm`, { token: adminTok, body: {} })).json.confirmedAt).toBeGreaterThan(0);
    const del = await call(`/narxtop/payments/${p2.id}`, { token: clientTok, method: 'DELETE', lang: 'ru' });
    expect(del.status).toBe(403);
    expect(del.json.error).toBe('Подтверждённую оплату может удалить только Сардор');
    expect((await call('/narxtop', { token: clientTok })).json.payments.some((x: { id: number }) => x.id === p2.id)).toBe(true);
    // admin yozgan to'lov darhol tasdiqlangan
    expect((await call('/narxtop/payments', { token: adminTok, body: { amount: 100 } })).json.confirmedAt).toBeGreaterThan(0);
  });
});

describe('Telegram Mini App', () => {
  const sec = () => Math.floor(Date.now() / 1000);
  const init = (id: number, authDate = sec(), token = BOT) => signWebAppInit({ auth_date: String(authDate), query_id: 'AAH', user: JSON.stringify({ id, first_name: 'Ish' }) }, token);

  it('ulanmagan Telegram — 403 not-linked (rus tilida)', async () => {
    const r = await call('/auth/telegram', { body: { initData: init(777001) }, lang: 'ru' });
    expect(r.status).toBe(403);
    expect(r.json.code).toBe('not-linked');
    expect(r.json.error).toMatch(/Telegram не подключён/);
  });

  it('bot orqali ulangandan keyin initData bilan parolsiz kirish', async () => {
    const link = await call('/me/telegram', { token: clientTok, body: {} });
    expect(link.json.url).toBe(`https://t.me/SinovBot?start=link_${link.json.code}`);
    expect((await call('/users/tg-link', { token: ADMIN, body: { code: link.json.code, tgId: '777001' } })).json.ok).toBe(true);
    const r = await call('/auth/telegram', { body: { initData: init(777001) } });
    expect(r.status).toBe(200);
    expect(r.json.me).toMatchObject({ login: 'ishchi', role: 'client', tgLinked: true });
    const me = await call('/me', { token: r.json.token });
    expect(me.json).toMatchObject({ login: 'ishchi', via: 'session' });
    // Mini App sessiyasi ham mijoz: admin yo'llari yopiq
    expect((await call('/state', { token: r.json.token })).status).toBe(403);
  });

  it('noto‘g‘ri imzo, boshqa bot tokeni va eski auth_date — 401', async () => {
    expect((await call('/auth/telegram', { body: { initData: init(777001).replace('777001', '777002') }, ip: '10.5.0.1' })).status).toBe(401);
    expect((await call('/auth/telegram', { body: { initData: init(777001, sec(), '999:boshqa') }, ip: '10.5.0.2' })).status).toBe(401);
    expect((await call('/auth/telegram', { body: { initData: init(777001, sec() - 2 * 86_400) }, ip: '10.5.0.3' })).status).toBe(401);
    expect((await call('/auth/telegram', { body: {}, ip: '10.5.0.4' })).status).toBe(401);
  });

  it('noto‘g‘ri initData bilan 10 urinishdan keyin 429', async () => {
    for (let i = 0; i < 10; i++) await call('/auth/telegram', { body: { initData: 'auth_date=1&hash=00' }, ip: '10.5.5.5' });
    expect((await call('/auth/telegram', { body: { initData: init(777001) }, ip: '10.5.5.5' })).status).toBe(429);
  });

  it('Excel bot orqali o‘z chatiga yuboriladi (sendDocument), Telegram ulanmagan admin — 400', async () => {
    tgCalls.length = 0;
    const r = await call('/narxtop/report/send', { token: clientTok, body: { period: 'all', lang: 'ru' } });
    expect(r.status).toBe(200);
    expect(r.json.name).toMatch(/^narxtop-otchet-vse-.*\.xlsx$/);
    const send = tgCalls.find((c) => c.method === 'sendDocument');
    expect(send?.body).toMatchObject({ chat_id: '777001', caption: '📊 Отчёт NARXTOP' });
    expect(String((send?.body as Record<string, string>).document)).toMatch(/^<fayl \d+ bayt>$/);
    expect((await call('/narxtop/report/send', { token: adminTok, body: { period: 'all' } })).status).toBe(400);
  });

  it('yangi vazifa haqida xabar admin(lar)ga emas, ulangan mijozga ketadi (admin yozsa)', async () => {
    tgCalls.length = 0;
    await call('/narxtop/orders', { token: adminTok, body: { title: 'Admin vazifasi' } });
    const msgs = tgCalls.filter((c) => c.method === 'sendMessage').map((c) => (c.body as { chat_id: string }).chat_id);
    expect(msgs).toEqual(['777001']);
  });
});
