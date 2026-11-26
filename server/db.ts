// SQLite (libSQL) + Drizzle. Holat jadvallardan yig'iladi; har amaldan keyin faqat O'ZGARGAN qatorlar yoziladi
// (Turso tekin tarifida oylik yozish limiti bor: avval har saqlashda ~250 qator qayta yozilardi va limit tugadi).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import type { Goals, State, Workspace } from '../src/core/types';
import * as schema from './schema';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR ?? 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

// Standart: DATA_DIR ichidagi SQLite fayl. DATABASE_URL=libsql://… (Turso) bersangiz masofaviy baza ishlatiladi.
const URL = process.env.DATABASE_URL || `file:${path.join(DATA_DIR, 'zavod.db')}`;
const client = createClient({ url: URL, authToken: process.env.DATABASE_AUTH_TOKEN || undefined });
export const db = drizzle(client, { schema });
/** Baza masofada (Turso): mahalliy disk ishonchsiz, fayllar ham bazaga ko'chiriladi (server/files.ts). */
export const REMOTE_DB = process.env.FILES_IN_DB === '1' || !URL.startsWith('file:'); // FILES_IN_DB=1: mahalliy sinov uchun

/** Baza yozishni rad etdimi (Turso limiti: "writes are blocked"). Shunda server o'qish rejimida ishlashda davom etadi. */
export function isWriteBlocked(e: unknown): boolean {
  for (let x = e as { message?: string; code?: string; cause?: unknown } | undefined, i = 0; x && i < 5; x = x.cause as typeof x, i++) {
    if (x.code === 'BLOCKED' || /writes are blocked|write operations are forbidden/i.test(x.message ?? '')) return true;
  }
  return false;
}
/** true — baza hozir faqat o'qish uchun (yozish bloklangan). /api/health da ko'rinadi. */
export let READ_ONLY = false;
export const markReadOnly = (where: string, e: unknown) => {
  if (!READ_ONLY) console.error(`Baza yozishni rad etdi (${where}): server faqat o'qish rejimida ishlaydi.`, (e as Error).message);
  READ_ONLY = true;
};

export async function initDb() {
  if (URL.startsWith('file:')) await client.execute('PRAGMA journal_mode = WAL');
  try {
    // Turso yozish bloklanganida PRAGMA ham rad etiladi — shuning uchun u ham shu himoya ichida
    await client.execute('PRAGMA foreign_keys = ON');
    await migrate(db, { migrationsFolder: path.join(ROOT, 'drizzle') });
  } catch (e) {
    // yangi migratsiya bo'lmasa, yozish bloklanganida ham baza o'qish uchun yaroqli
    if (!isWriteBlocked(e)) throw e;
    markReadOnly('migratsiya', e);
  }
}

export async function loadState(): Promise<State | null> {
  const metaRows = await db.select().from(schema.meta);
  if (!metaRows.length) return null;
  const m = Object.fromEntries(metaRows.map((r) => [r.key, r.value])) as { seededAt: number; nextId: State['nextId']; workspace: Workspace; goals: Goals; updatedAt?: number; channels?: State['channels'] };
  const [vRows, pRows, plRows, aRows] = await Promise.all([
    db.select().from(schema.videos).orderBy(asc(schema.videos.ord)),
    db.select().from(schema.posts).orderBy(asc(schema.posts.ord)),
    db.select().from(schema.platforms),
    db.select().from(schema.activity).orderBy(desc(schema.activity.id)),
  ]);
  // bazada nima borligini eslab qolamiz: keyingi saqlash faqat farqni yozadi
  const actIds = new Map<string, number[]>();
  for (const a of [...aRows].reverse()) { const k = actKey(a); actIds.set(k, [...(actIds.get(k) ?? []), a.id]); }
  const byVideo = new Map<string, State['videos'][number]['posts']>();
  for (const { ord: _o, videoId, ...p } of pRows) {
    if (!byVideo.has(videoId)) byVideo.set(videoId, []);
    byVideo.get(videoId)!.push({ ...p, url: p.url ?? undefined });
  }
  const loaded: State = {
    version: 1,
    seededAt: m.seededAt,
    updatedAt: m.updatedAt,
    nextId: m.nextId,
    workspace: m.workspace,
    goals: m.goals,
    platforms: plRows,
    videos: vRows.map(({ ord: _o, ...v }) => ({ ...v, posts: byVideo.get(v.id) ?? [] })),
    activity: aRows.map(({ t, type, text }) => ({ t, type, text })),
    ...(m.channels?.length ? { channels: m.channels } : {}),
  };
  dbSnap = { ...keyedRows(loaded, metaRows.find((r) => r.key === 'updatedAt')?.value as number | undefined), acts: actIds };
  lastSaved = JSON.stringify(loaded);
  return loaded;
}

// ---------- saqlash: faqat o'zgargan qatorlar ----------
type Keyed = { meta: Map<string, string>; platforms: Map<string, string>; videos: Map<string, string>; posts: Map<string, string> };
type Snap = Keyed & { acts: Map<string, number[]> };
/** Bazadagi hozirgi holat (qator kaliti → JSON). null — baza bo'sh deb hisoblanadi. */
let dbSnap: Snap | null = null;
let lastSaved = '';
const actKey = (a: { t: number; type: string; text: string }) => `${a.t}|${a.type}|${a.text}`;

function rows(s: State, updatedAt?: number) {
  const meta = [
    { key: 'seededAt', value: s.seededAt as unknown },
    { key: 'updatedAt', value: (s.updatedAt ?? updatedAt ?? Date.now()) as unknown },
    { key: 'nextId', value: s.nextId as unknown },
    { key: 'workspace', value: s.workspace as unknown },
    { key: 'goals', value: s.goals as unknown },
    ...(s.channels?.length ? [{ key: 'channels', value: s.channels as unknown }] : []),
  ];
  const platforms = s.platforms.map((p) => ({ ...p, manualDelta: p.manualDelta ?? 0 }));
  const videos = s.videos.map(({ posts: _p, ...v }, ord) => ({ ...v, ord, viral: !!v.viral }));
  const posts = s.videos.flatMap((v) => v.posts.map((p) => ({ ...p, videoId: v.id, url: p.url ?? null, error: p.error ?? null }))).map((p, ord) => ({ ...p, ord }));
  return { meta, platforms, videos, posts };
}
function keyedRows(s: State, updatedAt?: number): Keyed {
  const r = rows(s, updatedAt);
  return {
    meta: new Map(r.meta.map((x) => [x.key, JSON.stringify(x)])),
    platforms: new Map(r.platforms.map((x) => [x.id, JSON.stringify(x)])),
    videos: new Map(r.videos.map((x) => [x.id, JSON.stringify(x)])),
    posts: new Map(r.posts.map((x) => [x.id, JSON.stringify(x)])),
  };
}

/** Holatni saqlaydi: faqat o'zgargan, yangi yoki o'chirilgan qatorlar yoziladi (bitta tranzaksiyada). */
export async function saveState(s: State) {
  const snapStr = JSON.stringify(s);
  if (snapStr === lastSaved) return;
  const prev: Snap = dbSnap ?? { meta: new Map(), platforms: new Map(), videos: new Map(), posts: new Map(), acts: new Map() };
  const r = rows(s);
  const next = keyedRows(s);
  // updatedAt o'zi o'zgarishi saqlashga sabab bo'lmasin: faqat boshqa narsa o'zgarganda yoziladi
  const changed = <T,>(list: T[], key: (x: T) => string, old: Map<string, string>) => list.filter((x) => old.get(key(x)) !== JSON.stringify(x));
  const gone = (now: Map<string, string>, old: Map<string, string>) => [...old.keys()].filter((k) => !now.has(k));

  const metaUp = changed(r.meta, (x) => x.key, prev.meta), metaDel = gone(next.meta, prev.meta);
  const platUp = changed(r.platforms, (x) => x.id, prev.platforms), platDel = gone(next.platforms, prev.platforms);
  const vidUp = changed(r.videos, (x) => x.id, prev.videos), vidDel = gone(next.videos, prev.videos);
  const postUp = changed(r.posts, (x) => x.id, prev.posts), postDel = gone(next.posts, prev.posts);
  // jurnal: kalit (vaqt|tur|matn) bo'yicha; yangilari qo'shiladi, 200 tadan chiqib ketganlari o'chiriladi
  const want = new Map<string, number>();
  for (const a of s.activity) want.set(actKey(a), (want.get(actKey(a)) ?? 0) + 1);
  const actDel: number[] = [];
  const acts = new Map([...prev.acts].map(([k, ids]) => [k, [...ids]]));
  for (const [k, ids] of acts) { const extra = ids.length - (want.get(k) ?? 0); if (extra > 0) actDel.push(...ids.splice(0, extra)); if (!ids.length) acts.delete(k); }
  const actNew = [...s.activity].reverse().filter((a) => { const k = actKey(a), have = acts.get(k)?.length ?? 0, need = want.get(k) ?? 0; if (have >= need) return false; acts.set(k, [...(acts.get(k) ?? []), -1]); return true; });
  const onlyUpdatedAt = metaUp.length === 1 && metaUp[0].key === 'updatedAt' && !metaDel.length && !platUp.length && !platDel.length && !vidUp.length && !vidDel.length && !postUp.length && !postDel.length && !actDel.length && !actNew.length;
  if (onlyUpdatedAt) { lastSaved = snapStr; return; }

  await db.transaction(async (tx) => {
    if (postDel.length) await tx.delete(schema.posts).where(inArray(schema.posts.id, postDel));
    if (vidDel.length) await tx.delete(schema.videos).where(inArray(schema.videos.id, vidDel));
    if (platDel.length) await tx.delete(schema.platforms).where(inArray(schema.platforms.id, platDel as never[]));
    if (metaDel.length) await tx.delete(schema.meta).where(inArray(schema.meta.key, metaDel));
    if (actDel.length) await tx.delete(schema.activity).where(inArray(schema.activity.id, actDel));
    for (const m of metaUp) await tx.insert(schema.meta).values(m).onConflictDoUpdate({ target: schema.meta.key, set: { value: m.value } });
    for (const p of platUp) await tx.insert(schema.platforms).values(p).onConflictDoUpdate({ target: schema.platforms.id, set: p });
    for (const v of vidUp) await tx.insert(schema.videos).values(v).onConflictDoUpdate({ target: schema.videos.id, set: v });
    for (const p of postUp) await tx.insert(schema.posts).values(p).onConflictDoUpdate({ target: schema.posts.id, set: p });
    for (const a of actNew) {
      const [row] = await tx.insert(schema.activity).values({ t: a.t, type: a.type, text: a.text }).returning({ id: schema.activity.id });
      const ids = acts.get(actKey(a))!;
      ids[ids.indexOf(-1)] = row.id;
    }
  });
  dbSnap = { ...next, acts };
  lastSaved = snapStr;
}
void eq;
