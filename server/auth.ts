// Kirish: login + parol (scrypt) va imzolangan sessiya tokeni. ADMIN_TOKEN avtomatlashtirish (worker, skriptlar) uchun ishlashda davom etadi.
import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Me, Role } from '../src/core/narxtop';
import { db } from './db';
import { users } from './schema';

const TOKEN = process.env.ADMIN_TOKEN ?? '';
const SECRET = process.env.SESSION_SECRET || (TOKEN ? `kz-session:${TOKEN}` : 'kz-local-dev');
const SESSION_DAYS = 60;

export type AuthUser = { id: number; login: string; name: string; role: Role; tgId: string | null; via: 'session' | 'token' | 'local' };
export type Env = { Variables: { user: AuthUser } };

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  return `s1$${salt.toString('base64')}$${crypto.scryptSync(pw, salt, 32).toString('base64')}`;
}
export function checkPassword(pw: string, hash: string): boolean {
  const [v, salt, key] = hash.split('$');
  if (v !== 's1' || !salt || !key) return false;
  const want = Buffer.from(key, 'base64');
  const got = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), want.length);
  return crypto.timingSafeEqual(got, want);
}

const sign = (body: string) => crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
/** Token: u.<id>.<ver>.<muddat>.<imzo> — server hech narsa saqlamaydi, parol o'zgarsa (ver) eski tokenlar ishlamaydi. */
export function makeSession(id: number, ver: number, now = Date.now()): string {
  const body = `u.${id}.${ver}.${now + SESSION_DAYS * 86_400_000}`;
  return `${body}.${sign(body)}`;
}
function readSession(tok: string): { id: number; ver: number } | null {
  const parts = tok.split('.');
  if (parts.length !== 5 || parts[0] !== 'u') return null;
  const body = parts.slice(0, 4).join('.');
  const a = Buffer.from(sign(body)), b = Buffer.from(parts[4]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Number(parts[3]) < Date.now()) return null;
  return { id: Number(parts[1]), ver: Number(parts[2]) };
}

const sameToken = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const userCount = async () => (await db.select({ n: sql<number>`count(*)` }).from(users))[0]?.n ?? 0;

/** So'rov kimdan: ADMIN_TOKEN, sessiya tokeni yoki (token ham, foydalanuvchi ham yo'q mahalliy rejimda) mahalliy admin. */
export async function resolveUser(c: Context): Promise<AuthUser | null> {
  const h = c.req.header('Authorization') ?? '';
  const tok = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (tok && TOKEN && sameToken(tok, TOKEN)) return { id: 0, login: 'token', name: 'Admin', role: 'admin', tgId: process.env.TELEGRAM_OWNER_ID ?? null, via: 'token' };
  if (tok.startsWith('u.')) {
    const s = readSession(tok);
    if (!s) return null;
    const [u] = await db.select().from(users).where(eq(users.id, s.id));
    if (!u || u.ver !== s.ver) return null;
    return { id: u.id, login: u.login, name: u.name, role: u.role, tgId: u.tgId, via: 'session' };
  }
  if (!TOKEN && !tok && (await userCount()) === 0) return { id: 0, login: 'local', name: 'Admin', role: 'admin', tgId: null, via: 'local' };
  return null;
}

/** Mijoz (client) faqat Narxtop bo'limi va o'z profiliga kira oladi. */
const CLIENT_PATHS = [/^\/api\/narxtop(\/|$)/, /^\/api\/me(\/|$)/];

export const requireUser: MiddlewareHandler<Env> = async (c, next) => {
  const p = c.req.path;
  if (p.endsWith('/health') || p.endsWith('/auth/login')) return next();
  const u = await resolveUser(c);
  if (!u) return c.json({ error: 'Kirish kerak' }, 401);
  if (u.role === 'client' && !CLIENT_PATHS.some((re) => re.test(p))) return c.json({ error: 'Bu bo‘lim siz uchun yopiq' }, 403);
  c.set('user', u);
  return next();
};

export const adminOnly: MiddlewareHandler<Env> = async (c, next) => {
  if (c.get('user')?.role !== 'admin') throw new HTTPException(403, { message: 'Faqat admin uchun' });
  return next();
};

// Parolni taxmin qilishga qarshi: bitta IP dan 15 daqiqada 10 ta xato urinish.
const fails = new Map<string, { n: number; until: number }>();
const ipOf = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0].trim() || c.req.header('x-real-ip') || 'local';

const cleanLogin = (s: unknown) => String(s ?? '').trim().toLowerCase();
function checkNewPassword(pw: unknown): string {
  const s = String(pw ?? '');
  if (s.length < 6) throw new HTTPException(400, { message: 'Parol kamida 6 belgi bo‘lsin' });
  return s;
}
const meOf = (u: { id: number; login: string; name: string; role: Role; tgId: string | null }): Me => ({ id: u.id, login: u.login, name: u.name, role: u.role, tgLinked: !!u.tgId });

export const auth = new Hono<Env>()
  .post('/auth/login', async (c) => {
    const ip = ipOf(c), f = fails.get(ip);
    if (f && f.n >= 10 && f.until > Date.now()) return c.json({ error: 'Juda ko‘p urinish. 15 daqiqadan keyin qayta urinib ko‘ring.' }, 429);
    const b = await c.req.json<{ login?: string; password?: string }>().catch(() => ({}) as { login?: string; password?: string });
    const [u] = await db.select().from(users).where(eq(users.login, cleanLogin(b.login)));
    if (!u || !checkPassword(String(b.password ?? ''), u.passHash)) {
      const cur = f && f.until > Date.now() ? f : { n: 0, until: Date.now() + 15 * 60_000 };
      fails.set(ip, { n: cur.n + 1, until: cur.until });
      return c.json({ error: 'Login yoki parol noto‘g‘ri' }, 401);
    }
    fails.delete(ip);
    return c.json({ token: makeSession(u.id, u.ver), me: meOf(u) });
  })
  .get('/me', (c) => {
    const u = c.get('user');
    return c.json({ ...meOf(u), via: u.via });
  })
  .post('/me/password', async (c) => {
    const u = c.get('user');
    if (u.via !== 'session') throw new HTTPException(400, { message: 'Avval login va parol bilan kiring' });
    const b = await c.req.json<{ old?: string; password?: string }>();
    const [row] = await db.select().from(users).where(eq(users.id, u.id));
    if (!row || !checkPassword(String(b.old ?? ''), row.passHash)) throw new HTTPException(400, { message: 'Eski parol noto‘g‘ri' });
    const ver = row.ver + 1;
    await db.update(users).set({ passHash: hashPassword(checkNewPassword(b.password)), ver }).where(eq(users.id, u.id));
    return c.json({ token: makeSession(u.id, ver) });
  })
  /** Telegram'ni ulash: bot havolasi t.me/<bot>?start=link_<kod> (30 daqiqa amal qiladi). */
  .post('/me/telegram', async (c) => {
    const u = c.get('user');
    if (u.via !== 'session') throw new HTTPException(400, { message: 'Avval login va parol bilan kiring' });
    const code = crypto.randomBytes(9).toString('base64url');
    await db.update(users).set({ linkCode: code, linkExp: Date.now() + 30 * 60_000 }).where(eq(users.id, u.id));
    const bot = await botUsername();
    return c.json({ code, url: bot ? `https://t.me/${bot}?start=link_${code}` : null, bot });
  })
  .post('/me/telegram/unlink', async (c) => {
    const u = c.get('user');
    if (u.via === 'session') await db.update(users).set({ tgId: null }).where(eq(users.id, u.id));
    return c.json({ ok: true });
  })
  // --- foydalanuvchilarni boshqarish (faqat admin) ---
  .get('/users', adminOnly, async (c) => c.json((await db.select().from(users)).map((u) => ({ ...meOf(u), createdAt: u.createdAt }))))
  .post('/users', adminOnly, async (c) => {
    const b = await c.req.json<{ login?: string; name?: string; role?: Role; password?: string }>();
    const login = cleanLogin(b.login);
    if (!/^[a-z0-9._-]{3,32}$/.test(login)) throw new HTTPException(400, { message: 'Login 3–32 belgi: lotin harflari, raqam, nuqta, chiziqcha' });
    const name = String(b.name ?? '').trim() || login;
    const role: Role = b.role === 'admin' ? 'admin' : 'client';
    const [dup] = await db.select({ id: users.id }).from(users).where(eq(users.login, login));
    if (dup) throw new HTTPException(400, { message: 'Bu login band' });
    const [u] = await db.insert(users).values({ login, name, role, passHash: hashPassword(checkNewPassword(b.password)), createdAt: Date.now() }).returning();
    return c.json(meOf(u), 201);
  })
  .patch('/users/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'));
    const b = await c.req.json<{ name?: string; role?: Role; password?: string }>();
    const [row] = await db.select().from(users).where(eq(users.id, id));
    if (!row) throw new HTTPException(404, { message: 'Foydalanuvchi topilmadi' });
    const patch: Partial<typeof users.$inferInsert> = {};
    if (b.name?.trim()) patch.name = b.name.trim();
    if (b.role === 'admin' || b.role === 'client') patch.role = b.role;
    if (b.password) { patch.passHash = hashPassword(checkNewPassword(b.password)); patch.ver = row.ver + 1; }
    await db.update(users).set(patch).where(eq(users.id, id));
    return c.json({ ok: true });
  })
  .delete('/users/:id', adminOnly, async (c) => {
    const id = Number(c.req.param('id'));
    if (c.get('user').id === id) throw new HTTPException(400, { message: 'O‘zingizni o‘chira olmaysiz' });
    await db.delete(users).where(eq(users.id, id));
    return c.json({ ok: true });
  })
  // --- bot uchun (worker ADMIN_TOKEN bilan chaqiradi) ---
  .post('/users/tg-link', adminOnly, async (c) => {
    const b = await c.req.json<{ code?: string; tgId?: string }>();
    const [u] = await db.select().from(users).where(eq(users.linkCode, String(b.code ?? '')));
    if (!u || !b.tgId || (u.linkExp ?? 0) < Date.now()) return c.json({ ok: false });
    await db.update(users).set({ tgId: null }).where(eq(users.tgId, String(b.tgId)));
    await db.update(users).set({ tgId: String(b.tgId), linkCode: null, linkExp: null }).where(eq(users.id, u.id));
    return c.json({ ok: true, me: meOf({ ...u, tgId: String(b.tgId) }) });
  })
  .get('/users/by-tg/:tgId', adminOnly, async (c) => {
    const [u] = await db.select().from(users).where(eq(users.tgId, c.req.param('tgId')));
    return c.json(u ? meOf(u) : null);
  });

let botName: string | null | undefined;
export async function botUsername(): Promise<string | null> {
  if (botName !== undefined) return botName;
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) return (botName = null);
  try {
    const r = await (await fetch(`https://api.telegram.org/bot${t}/getMe`)).json() as { ok: boolean; result?: { username: string } };
    botName = r.ok ? r.result!.username : null;
  } catch { return null; }
  return botName;
}

/** Bog'langan foydalanuvchilarga Telegram xabari (bot tokeni bo'lmasa jim o'tadi). */
export async function tgNotify(chatIds: (string | null | undefined)[], text: string) {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) return;
  for (const chat_id of [...new Set(chatIds.filter(Boolean))]) {
    await fetch(`https://api.telegram.org/bot${t}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }) })
      .catch((e: Error) => console.error('tgNotify:', e.message));
  }
}
