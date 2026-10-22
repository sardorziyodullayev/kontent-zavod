// Kontent Zavod API serveri: Hono + SQLite. Productionda Vite build (dist/) ni ham beradi.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { ActionError, applyAction, emptyState, nextQueue, seed, tick, toCSV, type Action, type State } from '../src/core';
import { initDb, loadState, saveState } from './db';
import { restoreFiles, restoreStatus } from './files';
import { media, publicMedia } from './media';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const argPort = process.argv.indexOf('--port');
const PORT = Number(argPort > 0 ? process.argv[argPort + 1] : process.env.PORT) || 4310;
const TOKEN = process.env.ADMIN_TOKEN ?? '';
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

const ACTIONS = new Set<Action['type']>(['video.create', 'video.update', 'video.move', 'video.check', 'video.delete', 'post.schedule', 'post.reschedule', 'post.remove', 'post.retry', 'post.publishNow', 'post.published', 'post.failed', 'post.stats', 'platform.update', 'goals.update', 'workspace.update']);

const api = new Hono()
  // ADMIN_TOKEN o'rnatilgan bo'lsa butun API (o'qish ham) token so'raydi; /health ochiq qoladi (hosting tekshiruvi uchun).
  .use('*', async (c, next) => {
    if (!TOKEN || c.req.path.endsWith('/health')) return next();
    return bearerAuth({ token: TOKEN, invalidTokenMessage: { error: 'Token noto‘g‘ri' }, noAuthenticationHeaderMessage: { error: 'Token kerak (Authorization: Bearer …)' } })(c, next);
  })
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

const app = new Hono();
app.use('/api/*', logger());
app.route('/api', api);
app.route('/pub', publicMedia);
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  if (err instanceof ActionError || err instanceof SyntaxError) return c.json({ error: err.message }, 400);
  console.error(err);
  return c.json({ error: 'Server xatosi' }, 500);
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

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Kontent Zavod API: http://localhost:${PORT}/api`);
  if (fs.existsSync(DIST)) console.log(`Panel: http://localhost:${PORT}`);
  else console.log('Panel uchun: npm run dev (Vite, http://localhost:5173) yoki npm run build');
  if (!TOKEN) console.log('Diqqat: ADMIN_TOKEN o‘rnatilmagan — faqat mahalliy foydalanish uchun.');
  // WORKER=1: joylash workeri shu jarayonda ishlaydi (hostingda alohida xizmat kerak bo'lmaydi).
  // Worker fayllar bazadan to'liq tiklangandan keyin boshlanadi: aks holda video "yuklanmagan" deb
  // matnli post rejalashtirib qo'yishi mumkin. Tiklash xato bo'lsa har daqiqada qayta uriniladi.
  const restore = async (): Promise<void> => {
    const r = await restoreFiles().catch((e: Error) => { console.error('Fayllarni tiklab bo‘lmadi:', e.message); return null; });
    if (r?.done) return;
    await new Promise((ok) => setTimeout(ok, 60_000));
    return restore();
  };
  if (process.env.WORKER === '1') {
    process.env.PANEL_URL ||= `http://127.0.0.1:${PORT}`;
    void restore().then(() => import('../tools/worker')).catch((e: Error) => console.error('Worker ishga tushmadi:', e.message));
  } else void restore();
  // Render free 15 daqiqa so'rov kelmasa uxlaydi: o'zining ochiq manziliga har 10 daqiqada so'rov (worker va bot to'xtamasin).
  const self = process.env.KEEPALIVE_URL || process.env.RENDER_EXTERNAL_URL;
  if (self) setInterval(() => void fetch(`${self}/api/health`).catch(() => undefined), 10 * 60_000);
});

export type ApiType = typeof api;
