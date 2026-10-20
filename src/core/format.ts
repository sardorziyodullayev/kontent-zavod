// Toshkent vaqti va raqam formatlash.
import { DAY, DOW_SHORT, HOUR, MONTHS, SLOTS, TZ_OFFSET } from './constants';

export const local = (ms: number) => new Date(ms + TZ_OFFSET);
export const localHour = (ms: number) => local(ms).getUTCHours();
export const localDow = (ms: number) => (local(ms).getUTCDay() + 6) % 7; // 0 = Dushanba
export const dayStart = (ms: number) => Math.floor((ms + TZ_OFFSET) / DAY) * DAY - TZ_OFFSET;
export const at = (dayMs: number, h: number, m = 0) => dayStart(dayMs) + h * HOUR + m * 60e3;
export const slotOf = (h: number) => {
  if (h < 6) return 8;
  for (let i = SLOTS.length - 1; i >= 0; i--) if (h >= SLOTS[i]) return i;
  return 0;
};
export const slotLabel = (s: number) => `${String(SLOTS[s]).padStart(2, '0')}:00–${String((SLOTS[s] + 2) % 24).padStart(2, '0')}:00`;

export function fmtNum(n: number) {
  n = Math.round(n || 0);
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.0', '') + 'M';
  if (a >= 1e4) return Math.round(n / 1e3) + 'K';
  if (a >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}
export const fmtFull = (n: number) => Math.round(n || 0).toLocaleString('ru-RU').replace(/ /g, ' ');
export const pct = (x: number, d = 1) => (x * 100).toFixed(d).replace('.0', '') + '%';

export function fmtDate(ms: number, o: { weekday?: boolean; year?: boolean } = {}) {
  const d = local(ms);
  const parts: (string | number)[] = [];
  if (o.weekday) parts.push(DOW_SHORT[(d.getUTCDay() + 6) % 7] + ',');
  parts.push(d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]);
  if (o.year) parts.push(d.getUTCFullYear());
  return parts.join(' ');
}
export const fmtTime = (ms: number) => {
  const d = local(ms);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
};
export function fmtDur(ms: number) {
  const neg = ms < 0;
  ms = Math.abs(ms);
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / 60e3);
  const s = d ? `${d} kun ${h} soat` : h ? `${h} soat ${m} daq` : `${m} daqiqa`;
  return neg ? s + ' oldin' : s;
}
export function relDay(ms: number, now: number) {
  const diff = Math.round((dayStart(ms) - dayStart(now)) / DAY);
  if (diff === 0) return 'Bugun';
  if (diff === 1) return 'Ertaga';
  if (diff === -1) return 'Kecha';
  return fmtDate(ms, { weekday: true });
}
export function countdown(ms: number) {
  if (ms <= 0) return '00:00:00';
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / 60e3), s = Math.floor((ms % 60e3) / 1e3);
  const p = (x: number) => String(x).padStart(2, '0');
  return (d ? `${d}k ` : '') + `${p(h)}:${p(m)}:${p(s)}`;
}
/** Toshkent vaqtidagi sana/soat <input> qiymatlari. */
export const toInputs = (ms: number) => {
  const iso = local(ms).toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};
export const fromInputs = (date: string, time: string) => Date.parse(`${date}T${time || '00:00'}:00Z`) - TZ_OFFSET;
