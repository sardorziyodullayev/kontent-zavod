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

/** Tiklash holati /api/health da ko'rinadi (Render loglarisiz ham tekshirish uchun). */
export const restoreStatus: { done: boolean; restored: number; failed: string[] } = { done: false, restored: 0, failed: [] };

/** Ishga tushishda: bazadagi, diskda yo'q fayllarni tiklaydi. Bo'laklar birma-bir o'qiladi (xotira va javob hajmi kichik). */
export async function restoreFiles() {
  if (!REMOTE_DB) return Object.assign(restoreStatus, { done: true });
  const rows = await db.select({ path: files.path, idx: files.idx }).from(files);
  const byPath = new Map<string, number>();
  for (const r of rows) byPath.set(r.path, Math.max(byPath.get(r.path) ?? 0, r.idx + 1));
  restoreStatus.failed = [];
  for (const [p, n] of byPath) {
    if (fs.existsSync(p)) continue;
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      const tmp = p + '.restore';
      fs.writeFileSync(tmp, '');
      for (let i = 0; i < n; i++) {
        const [r] = await db.select({ data: files.data }).from(files).where(and(eq(files.path, p), eq(files.idx, i)));
        if (!r) throw new Error(`${i}-bo'lak yo'q`);
        fs.appendFileSync(tmp, r.data);
      }
      fs.renameSync(tmp, p);
      restoreStatus.restored++;
    } catch (e) {
      restoreStatus.failed.push(`${path.basename(p)}: ${(e as Error).message}`);
      console.error('Tiklab bo‘lmadi:', p, (e as Error).message);
    }
  }
  restoreStatus.done = !restoreStatus.failed.length;
  console.log(`Bazadan ${restoreStatus.restored} ta fayl tiklandi${restoreStatus.failed.length ? `, ${restoreStatus.failed.length} tasi xato` : ''}`);
  return restoreStatus;
}
