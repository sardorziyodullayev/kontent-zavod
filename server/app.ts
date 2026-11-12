// Kontent Zavod API ilovasi (listen'siz): Hono + SQLite. Productionda Vite build (dist/) ni ham beradi.
// Server server/index.ts da ishga tushadi; testlar shu `app` ni to'g'ridan-to'g'ri chaqiradi (app.request).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { ActionError, applyAction, emptyState, nextQueue, seed, tick, toCSV, type Action, type State } from '../src/core';
import crypto from 'node:crypto';
import { errLabel } from '../src/core/narxtop';
import { auth, reqLang, requireUser, type Env } from './auth';
import { initDb, loadState, saveState } from './db';
import { narxtop } from './narxtop';
import { restoreStatus } from './files';
import { media, publicMedia } from './media';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(ROOT, 'dist');
const argPort = process.argv.indexOf('--port');
export const PORT = Number(argPort > 0 ? process.argv[argPort + 1] : process.env.PORT) || 4310;
export const TOKEN = process.env.ADMIN_TOKEN ?? '';
if (process.env.NODE_ENV === 'production' && TOKEN.length < 16) {
  console.error('Production rejimida ADMIN_TOKEN kamida 16 belgi bo‘lishi shart.');
  process.exit(1);
}

await initDb();
// SEED=empty: bo'sh bazada namunaviy ma'lumot yaratilmaydi (production).
let state: State = (await loadState()) ?? (process.env.SEED === 'empty' ? emptyState(Date.now()) : seed(Date.now()));
await saveState(state);

// Amallar ketma-ket bajariladi: bir vaqtda kelgan ikki so'rov holatni buzmasin.
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = chain.then(fn);
  chain = run.catch(() => undefined);
  return run;
}
const act = (action: Action) =>
  serial(async () => {
    const now = Date.now();
    tick(state, now);
    const result = applyAction(state, action, now);
    await saveState(state);
    return result;
  });

setInterval(() => void serial(async () => { tick(state, Date.now()); await saveState(state); }), 60_000).unref();

const ACTIONS = new Set<Action['type']>(['video.create', 'video.update', 'video.move', 'video.check', 'video.delete', 'post.schedule', 'post.reschedule', 'post.remove', 'post.retry', 'post.publishNow', 'post.published', 'post.failed', 'post.stats', 'platform.update', 'channel.sync', 'goals.update', 'workspace.update']);

const api = new Hono<Env>()
  // Butun API kirishni talab qiladi: login/parol sessiyasi yoki ADMIN_TOKEN (worker, skriptlar). /health va /auth/login ochiq.
  // Mijoz (client) roli faqat /narxtop va /me ga kira oladi (server/auth.ts).
  .use('*', requireUser)
  .route('/', auth)
  .route('/narxtop', narxtop)
  // --- panel uchun ---
  .get('/state', (c) => { tick(state, Date.now()); return c.json({ mode: 'server' as const, now: Date.now(), state }); })
  .post('/action', async (c) => {
    const body = await c.req.json<{ type?: string; payload?: unknown }>();
    if (!body.type || !ACTIONS.has(body.type as Action['type'])) throw new HTTPException(400, { message: 'Noma’lum amal' });
    const result = await act({ type: body.type, payload: body.payload ?? {} } as Action);
    return c.json({ ok: true, result, now: Date.now(), state });
  })
  // {empty:true, keep:['v118']}: toza holat (ko'rsatilgan videolar saqlanadi); bo'lmasa namunaviy ma'lumot
  .post('/reset', async (c) => {
    const b = await c.req.json<{ empty?: boolean; keep?: string[] }>().catch(() => ({}) as { empty?: boolean; keep?: string[] });
    await serial(async () => {
      const now = Date.now();
      state = b.empty ? emptyState(now, state, state.videos.filter((v) => b.keep?.includes(v.id))) : seed(now);
      await saveState(state);
    });
    return c.json({ ok: true, state });
  })
  .post('/import', async (c) => {
    const b = await c.req.json<State>();
    if (!Array.isArray(b?.videos) || !Array.isArray(b?.platforms)) throw new HTTPException(400, { message: 'Fayl noto‘g‘ri' });
    await serial(async () => { state = tick(b, Date.now()); await saveState(state); });
    return c.json({ ok: true });
  })
  .get('/export.csv', (c) => c.body('﻿' + toCSV(state, Date.now()), 200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="kontent-zavod.csv"' }))
  // --- avtomatlashtirish (worker, n8n, render skriptlari) uchun ---
  // Avval tick: simulyatsiya yoqilgan bo'lsa vaqti kelgan postlarni server o'zi yopadi va worker ularni haqiqiy platformaga yubormaydi.
  .get('/queue', (c) => { tick(state, Date.now()); return c.json(nextQueue(state, Date.now())); })
  .get('/queue/next', (c) => { tick(state, Date.now()); return c.json(nextQueue(state, Date.now()).find((x) => x.ready) ?? null); })
  .post('/posts/:id/published', async (c) => c.json({ ok: true, result: await act({ type: 'post.published', payload: { ...(await c.req.json()), postId: c.req.param('id') } }) }))
  .post('/posts/:id/failed', async (c) => c.json({ ok: true, result: await act({ type: 'post.failed', payload: { ...(await c.req.json()), postId: c.req.param('id') } }) }))
  .post('/posts/:id/stats', async (c) => c.json({ ok: true, result: await act({ type: 'post.stats', payload: { ...(await c.req.json()), postId: c.req.param('id') } }) }))
  .post('/videos', async (c) => c.json(await act({ type: 'video.create', payload: await c.req.json() }), 201))
  .route('/media', media)
  .get('/health', (c) => c.json({ ok: true, auth: !!TOKEN, files: restoreStatus }));

export const app = new Hono();
// Xavfsizlik sarlavhalari. CSP: skriptlar faqat o'zimizdan (index.html dagi mavzu skripti xesh bilan ruxsat etiladi),
// shriftlar Google Fonts'dan; sahifani faqat o'zimiz va Telegram (Mini App) ichiga joylash mumkin.
const inlineHashes = (() => {
  try {
    const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`).join(' ');
  } catch { return ''; }
})();
const CSP = [
  "default-src 'self'", `script-src 'self' ${inlineHashes} https://telegram.org`, "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:", "media-src 'self' blob:", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
].join('; ');
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!c.req.path.startsWith('/pub/')) c.header('Content-Security-Policy', CSP);
});
if (!process.env.VITEST) app.use('/api/*', logger()); // testlarda jurnal shovqin qilmasin
app.route('/api', api);
app.route('/pub', publicMedia);
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: errLabel(err.message, reqLang(c)) }, err.status);
  if (err instanceof ActionError || err instanceof SyntaxError) return c.json({ error: err.message }, 400);
  console.error(err);
  return c.json({ error: errLabel('Server xatosi', reqLang(c)) }, 500);
});
app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'Topilmadi' }, 404) : c.text('Topilmadi', 404)));

if (fs.existsSync(DIST)) {
  // index.html har safar tekshiriladi (yangi deploydan keyin eski panel qolmasin), hashli assets uzoq keshlanadi
  app.use('/*', async (c, next) => {
    await next();
    if (c.req.path.startsWith('/api/')) return;
    c.header('Cache-Control', c.req.path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
  });
  app.use('/*', serveStatic({ root: path.relative(process.cwd(), DIST) || '.' }));
  app.get('*', (c) => c.html(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')));
}

export type ApiType = typeof api;
