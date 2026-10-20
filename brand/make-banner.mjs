// PixelMind YouTube banneri: 2560×1440. Hamma qurilmada ko'rinadigan zona — markazdagi 1546×423.
// node brand/make-banner.mjs [--guides] → brand/banner.html (Chrome headless bilan PNG qilinadi)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const GUIDES = process.argv.includes('--guides');
const W = 2560, H = 1440, SAFE = { w: 1546, h: 423 };
const sx = (W - SAFE.w) / 2, sy = (H - SAFE.h) / 2;
const INK = '#0e0e0c', PAPER = '#ecebe5', MUTED = '#9a9990', ACCENT = '#d4ff3a';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Piksel maydoni: o'ngda zich, chapga qarab tarqalib ketadi ("piksellar g'oyaga yig'ilmoqda")
const rng = mulberry32(20261020);
const CELL = 34, SQ = 26;
let pixels = '';
for (let y = 0; y < H; y += CELL) {
  for (let x = 0; x < W; x += CELL) {
    // matn chizig'ida (markaziy polosa) piksellar matndan keyin boshlanadi, yuqori/pastda (faqat TV) kengroq
    const inBand = y + SQ > sy - 20 && y < sy + SAFE.h + 20;
    const start = inBand ? 1960 : 1500;
    const t = (x - start) / (W - start); // 0 → 1 o'ngga qarab
    if (t <= 0) continue;
    const band = 1 - Math.min(1, Math.abs(y + SQ / 2 - H / 2) / (H * 0.62)); // markaz chizig'ida zichroq
    const p = Math.pow(t, 1.6) * (0.35 + 0.65 * band);
    if (rng() > p) continue;
    const lit = rng() < 0.06 * t; // kamdan-kam yorqin piksel
    const o = lit ? 1 : (0.1 + 0.32 * p * rng()).toFixed(3);
    pixels += `<rect x="${x}" y="${y}" width="${SQ}" height="${SQ}" rx="5" fill="${lit ? ACCENT : PAPER}" opacity="${o}"/>`;
  }
}

// logo belgisi (brand/logo-lime.svg bilan bir xil to'r)
const P = ['XXXX.', 'X...X', 'X.o.X', 'X...X', 'XXXX.', 'X....', 'X....'];
function logoTile(x, y, size) {
  const cell = size * 0.1075, gap = size * 0.0125, sq = cell - gap, r = size * 0.015;
  const w = 5 * cell - gap, h = 7 * cell - gap;
  const x0 = x + (size - w) / 2 + cell * 0.12, y0 = y + (size - h) / 2;
  let s = `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size * 0.22}" fill="${ACCENT}"/>`;
  P.forEach((row, ri) => [...row].forEach((c, i) => {
    if (c === '.') return;
    const px = x0 + i * cell, py = y0 + ri * cell;
    if (c === 'o') { const d = sq * 0.78, cx = px + sq / 2, cy = py + sq / 2; s += `<rect x="${cx - d / 2}" y="${cy - d / 2}" width="${d}" height="${d}" rx="${r * 0.6}" fill="${INK}" transform="rotate(45 ${cx} ${cy})"/>`; }
    else s += `<rect x="${px}" y="${py}" width="${sq}" height="${sq}" rx="${r}" fill="${INK}"/>`;
  }));
  return s;
}

const tile = 250, tx = sx + 40, ty = sy + (SAFE.h - tile) / 2;
const textX = tx + tile + 64;

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;700&family=Geist:wght@400;500;600&display=block" rel="stylesheet">
<style>
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${INK}}
  .t{position:absolute;left:${textX}px;font-family:Geist,system-ui,sans-serif;color:${PAPER}}
  .name{top:${sy + 70}px;font:700 132px/1 Unbounded,sans-serif;letter-spacing:-0.035em}
  .name i{font-style:normal;color:${ACCENT}}
  .tag{top:${sy + 232}px;font-size:46px;font-weight:500;color:${PAPER};letter-spacing:-0.01em}
  .meta{top:${sy + 310}px;font-size:32px;color:${MUTED};display:flex;gap:22px;align-items:center}
  .meta b{color:${ACCENT};font-weight:600}
  .dot{width:8px;height:8px;border-radius:2px;background:${MUTED};display:inline-block}
</style></head><body>
<svg width="${W}" height="${H}" style="position:absolute;inset:0">
  ${pixels}
  ${logoTile(tx, ty, tile)}
  ${GUIDES ? `<rect x="${sx}" y="${sy}" width="${SAFE.w}" height="${SAFE.h}" fill="none" stroke="#ff3b3b" stroke-width="4" stroke-dasharray="16 10"/><rect x="${(W - 1855) / 2}" y="${sy}" width="1855" height="${SAFE.h}" fill="none" stroke="#3bb0ff" stroke-width="3"/><rect x="0" y="${sy}" width="${W}" height="${SAFE.h}" fill="none" stroke="#ffffff" stroke-width="3" opacity=".5"/>` : ''}
</svg>
<div class="t name">Pixel<i>Mind</i></div>
<div class="t tag">Sun’iy intellekt biznesingiz uchun — o‘zbek tilida</div>
<div class="t meta"><span>Har kuni <b>qisqa video</b></span><span class="dot"></span><span>Har hafta <b>amaliy dars</b></span><span class="dot"></span><span>t.me/pixelminduz</span></div>
</body></html>`;
fs.writeFileSync(path.join(DIR, GUIDES ? 'banner-guides.html' : 'banner.html'), html);
console.log('tayyor', GUIDES ? '(chiziqlar bilan)' : '');
