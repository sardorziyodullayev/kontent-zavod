// SQLite (libSQL) + Drizzle. Holat jadvallardan yig'iladi va har bir amaldan keyin bitta tranzaksiyada yoziladi.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { asc, desc } from 'drizzle-orm';
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

export async function initDb() {
  if (URL.startsWith('file:')) await client.execute('PRAGMA journal_mode = WAL');
  await client.execute('PRAGMA foreign_keys = ON');
  await migrate(db, { migrationsFolder: path.join(ROOT, 'drizzle') });
}

export async function loadState(): Promise<State | null> {
  const metaRows = await db.select().from(schema.meta);
  if (!metaRows.length) return null;
  const m = Object.fromEntries(metaRows.map((r) => [r.key, r.value])) as { seededAt: number; nextId: State['nextId']; workspace: Workspace; goals: Goals; updatedAt?: number };
  const [vRows, pRows, plRows, aRows] = await Promise.all([
    db.select().from(schema.videos).orderBy(asc(schema.videos.ord)),
    db.select().from(schema.posts).orderBy(asc(schema.posts.ord)),
    db.select().from(schema.platforms),
    db.select().from(schema.activity).orderBy(desc(schema.activity.id)),
  ]);
  const byVideo = new Map<string, State['videos'][number]['posts']>();
  for (const { ord: _o, videoId, ...p } of pRows) {
    if (!byVideo.has(videoId)) byVideo.set(videoId, []);
    byVideo.get(videoId)!.push({ ...p, url: p.url ?? undefined });
  }
  return {
    version: 1,
    seededAt: m.seededAt,
    updatedAt: m.updatedAt,
    nextId: m.nextId,
    workspace: m.workspace,
    goals: m.goals,
    platforms: plRows,
    videos: vRows.map(({ ord: _o, ...v }) => ({ ...v, posts: byVideo.get(v.id) ?? [] })),
    activity: aRows.map(({ t, type, text }) => ({ t, type, text })),
  };
}

export async function saveState(s: State) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.posts);
    await tx.delete(schema.videos);
    await tx.delete(schema.platforms);
    await tx.delete(schema.activity);
    await tx.delete(schema.meta);
    await tx.insert(schema.meta).values([
      { key: 'seededAt', value: s.seededAt },
      { key: 'updatedAt', value: s.updatedAt ?? Date.now() },
      { key: 'nextId', value: s.nextId },
      { key: 'workspace', value: s.workspace },
      { key: 'goals', value: s.goals },
    ]);
    if (s.platforms.length) await tx.insert(schema.platforms).values(s.platforms.map((p) => ({ ...p, manualDelta: p.manualDelta ?? 0 })));
    const vRows = s.videos.map(({ posts: _p, ...v }, ord) => ({ ...v, ord, viral: !!v.viral }));
    const pRows = s.videos.flatMap((v) => v.posts.map((p) => ({ ...p, videoId: v.id, url: p.url ?? null, error: p.error ?? null }))).map((p, ord) => ({ ...p, ord }));
    for (let i = 0; i < vRows.length; i += 100) await tx.insert(schema.videos).values(vRows.slice(i, i + 100));
    for (let i = 0; i < pRows.length; i += 100) await tx.insert(schema.posts).values(pRows.slice(i, i + 100));
    // jurnal eng yangisi birinchi turadi; bazada eskisidan yangisiga yoziladi
    const acts = [...s.activity].reverse();
    for (let i = 0; i < acts.length; i += 100) await tx.insert(schema.activity).values(acts.slice(i, i + 100));
  });
}
