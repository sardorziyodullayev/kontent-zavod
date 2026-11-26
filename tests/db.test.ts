// Saqlash faqat o'zgargan qatorlarni yozadimi va bazadan qayta o'qilgan holat bir xilmi (Turso yozish limiti uchun).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Action } from '../src/core';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kz-db-'));
process.env.DATA_DIR = DIR;
delete process.env.DATABASE_URL;

type DbMod = typeof import('../server/db');
let D: DbMod;
let C: typeof import('../src/core');
/** null va yo'q maydon bir xil (bazadan o'qilganda undefined → null bo'ladi) */
const norm = (x: unknown) => JSON.parse(JSON.stringify(x, (_k, v) => (v === null ? undefined : v)));
const writes = async () => Number((await D.db.$client.execute('SELECT total_changes() AS n')).rows[0].n);

beforeAll(async () => {
  D = await import('../server/db');
  C = await import('../src/core');
  await D.initDb();
});

describe('saveState: faqat farq yoziladi', () => {
  const NOW = Date.UTC(2026, 10, 1, 5);
  test('to‘liq aylanish va kichik o‘zgarish', async () => {
    const s = C.seed(NOW);
    await D.saveState(s);
    const loaded = (await D.loadState())!;
    expect(norm(loaded.videos)).toEqual(norm(s.videos));
    expect(loaded.activity).toEqual(s.activity);

    // o'zgarishsiz saqlash — hech narsa yozilmaydi
    let w0 = await writes();
    await D.saveState(loaded);
    expect(await writes()).toBe(w0);

    // bitta video nomi o'zgardi — 1 video qatori + jurnal yozuvi (+ updatedAt) yoziladi, butun baza emas
    const total = loaded.videos.length + loaded.videos.flatMap((v) => v.posts).length + loaded.activity.length;
    w0 = await writes();
    C.applyAction(loaded, { type: 'video.update', payload: { id: loaded.videos[0].id, patch: { title: 'Yangi nom' } } } as Action, NOW + 1000);
    await D.saveState(loaded);
    const used = (await writes()) - w0;
    expect(used).toBeGreaterThan(0);
    expect(used).toBeLessThan(10);
    expect(total).toBeGreaterThan(50);

    // qayta o'qilgan holat xotiradagisi bilan bir xil
    const again = (await D.loadState())!;
    expect(again.videos[0].title).toBe('Yangi nom');
    expect(norm(again.videos)).toEqual(norm(loaded.videos));
    expect(again.activity).toEqual(loaded.activity);

    // video o'chirildi — uning postlari ham bazadan ketadi
    const gone = again.videos[1].id;
    C.applyAction(again, { type: 'video.delete', payload: { id: gone } } as Action, NOW + 2000);
    await D.saveState(again);
    const after = (await D.loadState())!;
    expect(after.videos.some((v) => v.id === gone)).toBe(false);
    expect(after.videos.length).toBe(again.videos.length);
    expect(after.activity).toEqual(again.activity);
  });

  test('yozish bloklanganini taniydi', () => {
    expect(D.isWriteBlocked({ message: 'x', cause: { code: 'BLOCKED', message: 'SQL write operations are forbidden (writes are blocked)' } })).toBe(true);
    expect(D.isWriteBlocked(new Error('UNIQUE constraint failed'))).toBe(false);
  });
});
