// Render free kabi hostinglarda disk har qayta ishga tushishda o'chadi. Baza masofada (Turso) bo'lsa,
// media va worker fayllari bazaga ham yoziladi va server ishga tushganda diskka qaytariladi.
// Mahalliy SQLite bilan hammasi no-op: fayllar diskda qoladi.
import fs from 'node:fs';
import path from 'node:path';
import { and, eq, gte } from 'drizzle-orm';
import { REMOTE_DB, db } from './db';
import { files } from './schema';

const CHUNK = 1024 * 1024;
const key = (file: string) => path.resolve(file);

/** Diskdagi faylni bazaga yozadi (eski nusxa almashtiriladi). */
export async function mirror(file: string) {
  if (!REMOTE_DB) return;
  const buf = fs.readFileSync(file);
  const p = key(file), mtime = Date.now();
  const n = Math.max(1, Math.ceil(buf.length / CHUNK));
  for (let i = 0; i < n; i++) {
    const data = buf.subarray(i * CHUNK, (i + 1) * CHUNK);
    await db.insert(files).values({ path: p, idx: i, data, mtime }).onConflictDoUpdate({ target: [files.path, files.idx], set: { data, mtime } });
  }
  // fayl qisqargan bo'lsa ortiqcha bo'laklar
  await db.delete(files).where(and(eq(files.path, p), gte(files.idx, n)));
}

export async function unmirror(file: string) {
  if (!REMOTE_DB) return;
  await db.delete(files).where(eq(files.path, key(file)));
}

/** Xato bo'lsa ham asosiy ishni to'xtatmaydi. */
export const mirrorSoon = (file: string) => void mirror(file).catch((e: Error) => console.error('Bazaga nusxa:', file, e.message));

/** Ishga tushishda: bazadagi, diskda yo'q fayllarni tiklaydi. */
export async function restoreFiles() {
  if (!REMOTE_DB) return;
  const list = await db.selectDistinct({ path: files.path }).from(files);
  let n = 0;
  for (const { path: p } of list) {
    if (fs.existsSync(p)) continue;
    const parts = await db.select({ data: files.data }).from(files).where(eq(files.path, p)).orderBy(files.idx);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p + '.restore', Buffer.concat(parts.map((r) => r.data)));
    fs.renameSync(p + '.restore', p);
    n++;
  }
  if (n) console.log(`Bazadan ${n} ta fayl tiklandi`);
}
