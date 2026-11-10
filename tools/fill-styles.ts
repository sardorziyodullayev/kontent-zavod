// Uslubi kiritilmagan vazifalarga uslubni nomidan/yo'nalishidan aniqlab qo'yadi (bir martalik, eski jadval ma'lumoti uchun).
//  "Моушн видео …" / "motion" → Motion;  yo'nalishi Serial → 2D animatsiya (1-oydagi seriallar ham multfilm edi).
// Aniqlab bo'lmaganlari o'zgarmaydi — saytda "uslub kiritilmagan" deb ko'rinadi, qo'lda tanlanadi.
// Ishga tushirish: npx tsx --env-file=.env.render tools/fill-styles.ts --panel https://… [--dry]
import type { NarxtopData } from '../src/core/narxtop';

const arg = (k: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const PANEL = arg('--panel') ?? process.env.PANEL_URL ?? 'http://localhost:4310';
const DRY = process.argv.includes('--dry');
const H = { 'Content-Type': 'application/json', ...(process.env.ADMIN_TOKEN ? { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` } : {}) };

const guess = (title: string, direction: string) => (/моушн|motion|moushn/i.test(title) ? 'Motion' : direction === 'Serial' ? '2D animatsiya' : null);

const d = (await (await fetch(`${PANEL}/api/narxtop`, { headers: H })).json()) as NarxtopData;
const todo = d.orders.filter((o) => !o.style).map((o) => ({ o, style: guess(o.title, o.direction) }));
for (const { o, style } of todo) {
  console.log(`${style ? '→' : '?'} #${o.id} ${o.title} [${o.direction || '—'}] ${style ?? '(aniqlanmadi)'}`);
  if (style && !DRY) {
    const r = await fetch(`${PANEL}/api/narxtop/orders/${o.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ style }) });
    if (!r.ok) throw new Error(`#${o.id}: ${r.status}`);
  }
}
console.log(`uslubsiz: ${todo.length}, aniqlandi: ${todo.filter((x) => x.style).length}`);
