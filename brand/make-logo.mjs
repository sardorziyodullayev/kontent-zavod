// PixelMind logosi: piksellardan yig'ilgan "P", ichida bitta yorqin piksel — "g'oya".
// node brand/make-logo.mjs → brand/*.svg va ko'rib chiqish varag'i (preview.html)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const INK = '#0e0e0c', PAPER = '#ecebe5', ACCENT = '#d4ff3a';

// 5×7 to'r: X — harf pikseli, o — markazdagi "g'oya" pikseli
const P = ['XXXX.', 'X...X', 'X.o.X', 'X...X', 'XXXX.', 'X....', 'X....'];

function mark({ bg, fg, dot, size = 800, cell = 86, gap = 10, radius = 12 }) {
  const w = P[0].length * cell - gap, h = P.length * cell - gap;
  const x0 = (size - w) / 2 + cell * 0.12, y0 = (size - h) / 2; // optik markaz: P chapga og'ir
  const sq = cell - gap;
  let rects = '';
  P.forEach((row, r) => [...row].forEach((c, i) => {
    if (c === '.') return;
    const x = x0 + i * cell, y = y0 + r * cell;
    if (c === 'o') {
      // "g'oya" pikseli: 45° burilgan romb — rangi bir xil bo'lsa ham shakli ajralib turadi
      const d = sq * 0.78, cx = x + sq / 2, cy = y + sq / 2;
      rects += `<rect x="${cx - d / 2}" y="${cy - d / 2}" width="${d}" height="${d}" rx="${radius * 0.6}" fill="${dot}" transform="rotate(45 ${cx} ${cy})"/>`;
    } else rects += `<rect x="${x}" y="${y}" width="${sq}" height="${sq}" rx="${radius}" fill="${fg}"/>`;
  }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/>${rects}</svg>`;
}

const variants = {
  'logo-lime': mark({ bg: ACCENT, fg: INK, dot: INK }),
  'logo-dark': mark({ bg: '#1c1c19', fg: PAPER, dot: ACCENT }),
};
for (const [k, svg] of Object.entries(variants)) fs.writeFileSync(path.join(DIR, `${k}.svg`), svg);

// ko'rib chiqish: to'liq o'lcham (kvadrat), YouTube doira kesimi 98 px va 36 px (izohdagi avatar)
const card = (k) => `<div class="v"><h2>${k}</h2><img class="big" src="${k}.svg">
  ${['#0f0f0f', '#ffffff'].map((bg) => `<div class="row" style="background:${bg}"><img class="c98" src="${k}.svg"><img class="c36" src="${k}.svg"><img class="c24" src="${k}.svg"></div>`).join('')}</div>`;
fs.writeFileSync(path.join(DIR, 'preview.html'), `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#202020;color:#ddd;font:16px system-ui;display:flex;gap:24px}
.v{background:#161616;padding:18px;border-radius:12px}.big{width:300px;height:300px;border-radius:50%;display:block}
.row{display:flex;align-items:center;gap:14px;margin-top:12px;padding:10px 14px;border-radius:8px}.c98{width:98px;height:98px;border-radius:50%}.c36{width:36px;height:36px;border-radius:50%}.c24{width:24px;height:24px;border-radius:50%}
h2{margin:0 0 10px;font-size:16px}</style>${Object.keys(variants).map(card).join('')}`);
console.log('tayyor:', Object.keys(variants).join(', '));
