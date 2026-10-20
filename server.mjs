// Kontent Zavod — admin panel serveri. Bog'liqliksiz: faqat Node.js (>=18).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed, tick, applyAction, nextQueue, toCSV } from './public/js/core.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT) || 4310;
const TOKEN = process.env.ADMIN_TOKEN || ''; // bo'sh bo'lsa — mahalliy rejim, himoyasiz

fs.mkdirSync(DATA_DIR, { recursive: true });
let state = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB, 'utf8')) : seed(Date.now());
const save = () => { const tmp = DB + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state)); fs.renameSync(tmp, DB); };
save();

// har daqiqada: vaqti kelgan postlarni joylash va statistikani yangilash
setInterval(() => { tick(state, Date.now()); save(); }, 60e3).unref();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok, fail) => {
  let b = '';
  req.on('data', (c) => { b += c; if (b.length > 5e6) req.destroy(); });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { fail(new Error('JSON noto‘g‘ri')); } });
});
const authed = (req) => !TOKEN || req.headers.authorization === `Bearer ${TOKEN}`;

function act(type, payload) {
  const now = Date.now();
  tick(state, now);
  const { result } = applyAction(state, { type, payload }, now);
  save();
  return result;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p.startsWith('/api/')) {
      if (req.method !== 'GET' && !authed(req)) return send(res, 401, { error: 'Token kerak (Authorization: Bearer …)' });
      // --- panel uchun ---
      if (p === '/api/state' && req.method === 'GET') { tick(state, Date.now()); return send(res, 200, { mode: 'server', now: Date.now(), state }); }
      if (p === '/api/action' && req.method === 'POST') {
        const { type, payload } = await readBody(req);
        const result = act(type, payload);
        return send(res, 200, { ok: true, result, now: Date.now(), state });
      }
      if (p === '/api/reset' && req.method === 'POST') { state = seed(Date.now()); save(); return send(res, 200, { ok: true, state }); }
      if (p === '/api/import' && req.method === 'POST') { const b = await readBody(req); if (!Array.isArray(b.videos)) throw new Error('Fayl noto‘g‘ri'); state = b; save(); return send(res, 200, { ok: true }); }
      if (p === '/api/export.csv') return send(res, 200, '﻿' + toCSV(state, Date.now()), 'text/csv; charset=utf-8');
      // --- avtomatlashtirish (worker, n8n, render.mjs) uchun ---
      if (p === '/api/queue' && req.method === 'GET') return send(res, 200, nextQueue(state, Date.now()));
      if (p === '/api/queue/next' && req.method === 'GET') {
        const q = nextQueue(state, Date.now()).filter((x) => x.ready);
        return send(res, 200, q[0] || null);
      }
      let m;
      if ((m = p.match(/^\/api\/posts\/(\w+)\/(published|failed|stats)$/)) && req.method === 'POST') {
        const b = await readBody(req);
        const type = { published: 'post.published', failed: 'post.failed', stats: 'post.stats' }[m[2]];
        return send(res, 200, { ok: true, result: act(type, { postId: m[1], ...b }) });
      }
      if (p === '/api/videos' && req.method === 'POST') return send(res, 201, act('video.create', await readBody(req)));
      if (p === '/api/health') return send(res, 200, { ok: true, videos: state.videos.length, updatedAt: state.updatedAt });
      return send(res, 404, { error: 'Topilmadi' });
    }
    // statik fayllar
    let file = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : decodeURIComponent(p)));
    if (!file.startsWith(PUBLIC)) return send(res, 403, 'Taqiqlangan', 'text/plain');
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`Kontent Zavod paneli: http://localhost:${PORT}`);
  console.log(TOKEN ? 'Yozish amallari token bilan himoyalangan.' : 'Diqqat: ADMIN_TOKEN o‘rnatilmagan — faqat mahalliy foydalanish uchun.');
});
