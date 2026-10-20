// YouTube kanalini ulash: Google OAuth orqali refresh token olib .env ga yozadi.
// 1. Google Cloud'da "Desktop app" turidagi OAuth client yarating va JSON faylini loyiha papkasiga saqlang (client_secret_*.json).
// 2. npm run youtube:auth  → brauzer ochiladi, kanalni tanlab ruxsat bering.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const ENV = path.resolve('.env');
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'];

function clientCreds(): { id: string; secret: string } {
  if (process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET) return { id: process.env.YOUTUBE_CLIENT_ID, secret: process.env.YOUTUBE_CLIENT_SECRET };
  const file = fs.readdirSync('.').find((f) => /^client_secret.*\.json$/.test(f));
  if (!file) throw new Error('client_secret_*.json topilmadi. Google Cloud → Credentials → OAuth client (Desktop app) → JSON yuklab, shu papkaga qo‘ying.');
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const c = j.installed ?? j.web;
  if (!c?.client_id) throw new Error(`${file} formati noto‘g‘ri`);
  return { id: c.client_id, secret: c.client_secret };
}

/** .env dagi kalitlarni yangilaydi (bo'lmasa qo'shadi), qolgan qatorlarga tegmaydi. */
function writeEnv(vals: Record<string, string>) {
  let text = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : '';
  for (const [k, v] of Object.entries(vals)) {
    const re = new RegExp(`^${k}=.*$`, 'm');
    text = re.test(text) ? text.replace(re, `${k}=${v}`) : `${text.replace(/\n?$/, '\n')}${k}=${v}\n`;
  }
  fs.writeFileSync(ENV, text);
}

function openBrowser(url: string) {
  const [cmd, args] = process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  execFile(cmd, args, () => undefined);
}

const { id, secret } = clientCreds();
const code = await new Promise<{ code: string; redirect: string }>((ok, fail) => {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (u.pathname !== '/') return res.writeHead(404).end();
    const err = u.searchParams.get('error');
    const c = u.searchParams.get('code');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(c ? '<h2>YouTube ulandi. Bu oynani yopishingiz mumkin.</h2>' : `<h2>Xato: ${err}</h2>`);
    srv.close();
    c ? ok({ code: c, redirect }) : fail(new Error(`Google: ${err}`));
  });
  let redirect = '';
  srv.listen(0, '127.0.0.1', () => {
    redirect = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/`;
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent' }).toString();
    console.log('Brauzerda ruxsat bering. Ochilmasa, shu havolani oching:\n' + auth);
    openBrowser(auth.toString());
  });
  setTimeout(() => { srv.close(); fail(new Error('5 daqiqada javob kelmadi')); }, 5 * 60_000).unref();
});

const tok: { refresh_token?: string; access_token?: string; error_description?: string } = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({ code: code.code, client_id: id, client_secret: secret, redirect_uri: code.redirect, grant_type: 'authorization_code' }),
})).json();
if (!tok.refresh_token) throw new Error(`Refresh token olinmadi: ${tok.error_description ?? JSON.stringify(tok)}`);

const ch: { items?: { snippet: { title: string; customUrl?: string }; statistics: { subscriberCount: string } }[] } = await (await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', { headers: { Authorization: `Bearer ${tok.access_token}` } })).json();
const c = ch.items?.[0];
writeEnv({ YOUTUBE_CLIENT_ID: id, YOUTUBE_CLIENT_SECRET: secret, YOUTUBE_REFRESH_TOKEN: tok.refresh_token });
console.log(c ? `✓ Kanal: ${c.snippet.title} ${c.snippet.customUrl ?? ''} · ${c.statistics.subscriberCount} obunachi` : '✓ Token olindi, lekin bu akkauntda YouTube kanal topilmadi');
console.log('YOUTUBE_* kalitlari .env ga yozildi.');
