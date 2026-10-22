// Video fayllar: panel yuklaydi, worker platformaga yuboradi. Fayl nomi: <MEDIA_DIR>/<videoId>.mp4|.mov
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { mirror, unmirror } from './files';

export const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR ?? 'media');
const MAX_BYTES = Number(process.env.MEDIA_MAX_MB ?? 300) * 1024 * 1024;
const EXT: Record<string, string> = { 'video/mp4': '.mp4', 'video/quicktime': '.mov' };

const safeId = (id: string) => {
  if (!/^v\d+$/.test(id)) throw new HTTPException(400, { message: 'Video id noto‘g‘ri' });
  return id;
};
const filesOf = (id: string) => ['.mp4', '.mov'].map((e) => path.join(MEDIA_DIR, id + e)).filter((f) => fs.existsSync(f));

export interface MediaInfo { videoId: string; name: string; size: number; uploadedAt: number }

export function listMedia(): MediaInfo[] {
  if (!fs.existsSync(MEDIA_DIR)) return [];
  return fs.readdirSync(MEDIA_DIR)
    .filter((n) => /^v\d+\.(mp4|mov)$/.test(n))
    .map((name) => { const st = fs.statSync(path.join(MEDIA_DIR, name)); return { videoId: name.replace(/\.\w+$/, ''), name, size: st.size, uploadedAt: st.mtimeMs }; });
}

export const media = new Hono()
  .get('/', (c) => c.json(listMedia()))
  // Tana — faylning o'zi (multipart emas): fetch(url, { method: 'PUT', body: file })
  .put('/:id', async (c) => {
    const id = safeId(c.req.param('id'));
    const ext = EXT[(c.req.header('Content-Type') ?? '').split(';')[0]];
    if (!ext) throw new HTTPException(415, { message: 'Faqat MP4 yoki MOV' });
    const len = Number(c.req.header('Content-Length') ?? 0);
    if (len > MAX_BYTES) throw new HTTPException(413, { message: `Fayl ${Math.round(MAX_BYTES / 1048576)} MB dan katta` });
    const body = c.req.raw.body;
    if (!body) throw new HTTPException(400, { message: 'Fayl yuborilmadi' });
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    const tmp = path.join(MEDIA_DIR, `${id}.upload`);
    let size = 0;
    const counter = Readable.fromWeb(body as WebReadableStream).on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) counter.destroy(new HTTPException(413, { message: 'Fayl juda katta' }));
    });
    try {
      await pipeline(counter, fs.createWriteStream(tmp));
    } catch (e) {
      fs.rmSync(tmp, { force: true });
      throw e;
    }
    for (const f of filesOf(id)) { fs.rmSync(f); await unmirror(f); }
    const file = path.join(MEDIA_DIR, id + ext);
    fs.renameSync(tmp, file);
    await mirror(file);
    return c.json(listMedia().find((m) => m.videoId === id), 201);
  })
  .delete('/:id', async (c) => {
    for (const f of filesOf(safeId(c.req.param('id')))) { fs.rmSync(f); await unmirror(f); }
    return c.json({ ok: true });
  });
