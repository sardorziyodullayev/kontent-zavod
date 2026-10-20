// Qo'lda yozilgan SVG grafiklar: chiziqli grafik (crosshair + tooltip), sparkline.
import { fmtNum, fmtFull } from './core.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let tipEl;
export function tip() {
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
  return tipEl;
}
export function showTip(html, x, y) {
  const t = tip();
  t.innerHTML = html; t.style.display = 'block';
  const w = t.offsetWidth, h = t.offsetHeight;
  let left = x + 16, top = y - h / 2;
  if (left + w > innerWidth - 8) left = x - w - 16;
  top = Math.max(8, Math.min(innerHeight - h - 8, top));
  t.style.left = left + 'px'; t.style.top = top + 'px';
}
export const hideTip = () => { if (tipEl) tipEl.style.display = 'none'; };

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/**
 * cfg: { labels: string[], series: [{id, name, color, values:number[], hidden?}], height, total?:bool, fmt?, area?:bool }
 */
export function lineChart(el, cfg) {
  const W = Math.max(280, el.clientWidth), H = cfg.height || 260;
  const m = { l: 44, r: 14, t: 10, b: 26 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const vis = cfg.series.filter((s) => !s.hidden);
  const n = cfg.labels.length;
  const max = niceMax(Math.max(1, ...vis.flatMap((s) => s.values)));
  const x = (i) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => m.t + ih - (v / max) * ih;
  const fmt = cfg.fmt || fmtNum;
  let svg = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(cfg.aria || 'Grafik')}">`;
  for (let k = 0; k <= 4; k++) {
    const v = (max / 4) * k, yy = Math.round(y(v)) + 0.5;
    svg += `<line class="${k ? 'grid-line' : 'axis-line'}" x1="${m.l}" x2="${W - m.r}" y1="${yy}" y2="${yy}"/>`;
    svg += `<text x="${m.l - 8}" y="${yy + 4}" text-anchor="end">${fmt(v)}</text>`;
  }
  const step = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
  for (let i = 0; i < n; i += step) svg += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : 'middle'}">${esc(cfg.labels[i])}</text>`;
  for (const s of vis) {
    const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    if (cfg.area && vis.length === 1) svg += `<polygon points="${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}" style="fill:${s.color}" opacity="0.1"/>`;
    svg += `<polyline points="${pts}" fill="none" style="stroke:${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = s.values.length - 1;
    svg += `<circle cx="${x(last)}" cy="${y(s.values[last])}" r="4" style="fill:${s.color};stroke:var(--surface)" stroke-width="2"/>`;
  }
  svg += `<line class="xhair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ih}" style="display:none"/><g class="hdots"></g>`;
  svg += `<rect x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent" class="hit"/></svg>`;
  el.innerHTML = svg;
  const root = el.querySelector('svg'), hair = root.querySelector('.xhair'), dots = root.querySelector('.hdots');
  const move = (ev) => {
    const r = root.getBoundingClientRect();
    const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
    hair.setAttribute('x1', x(i)); hair.setAttribute('x2', x(i)); hair.style.display = '';
    dots.innerHTML = vis.map((s) => `<circle cx="${x(i)}" cy="${y(s.values[i])}" r="4.5" style="fill:${s.color};stroke:var(--surface)" stroke-width="2"/>`).join('');
    const rows = [...vis].sort((a, b) => b.values[i] - a.values[i]).map((s) => `<div class="tr"><span><i class="dot" style="background:${s.color}"></i>${esc(s.name)}</span><b>${fmtFull(s.values[i])}</b></div>`).join('');
    const tot = cfg.total && vis.length > 1 ? `<div class="tr tot"><span>Jami</span><b>${fmtFull(vis.reduce((a, s) => a + s.values[i], 0))}</b></div>` : '';
    showTip(`<div class="th">${esc(cfg.tipLabels ? cfg.tipLabels[i] : cfg.labels[i])}</div>${rows}${tot}`, r.left + x(i), (ev.touches ? ev.touches[0].clientY : ev.clientY));
  };
  const leave = () => { hair.style.display = 'none'; dots.innerHTML = ''; hideTip(); };
  const hit = root.querySelector('.hit');
  hit.addEventListener('mousemove', move); hit.addEventListener('mouseleave', leave);
  hit.addEventListener('touchstart', move, { passive: true }); hit.addEventListener('touchmove', move, { passive: true }); hit.addEventListener('touchend', leave);
}

export function sparkline(values, { w = 96, h = 28, color = 'var(--muted)', accent = 'var(--accent-text)' } = {}) {
  if (!values.length) return '';
  const max = Math.max(1, ...values), min = Math.min(...values);
  const x = (i) => 2 + (i / Math.max(1, values.length - 1)) * (w - 6);
  const y = (v) => 3 + (h - 6) * (1 - (v - min) / (max - min || 1));
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const l = values.length - 1;
  return `<svg width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" style="stroke:${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(l)}" cy="${y(values[l])}" r="3" style="fill:${accent}"/></svg>`;
}
