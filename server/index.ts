// Kontent Zavod API serveri: ilovani (server/app.ts) portda ishga tushiradi, worker va keepalive.
import fs from 'node:fs';
import { serve } from '@hono/node-server';
import { app, DIST, PORT, TOKEN } from './app';
import { restoreFiles } from './files';

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

export type { ApiType } from './app';
