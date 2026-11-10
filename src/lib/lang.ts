// Narxtop bo'limi tili: o'zbek / rus. Ish beruvchi rus tilida ishlaydi.
// Tanlov brauzerda (kz-lang) va foydalanuvchi profilida (bot xabarlari shu tilda) saqlanadi.
import type { Lang } from '@/core/narxtop';
import { ls } from './utils';

const KEY = 'kz-lang';
const saved = () => { const v = ls.get(KEY); return v === 'ru' || v === 'uz' ? v : null; };
let cur: Lang = saved() ?? (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru') ? 'ru' : 'uz');

export const lang = (): Lang => cur;
/** Matn joriy tilda: L('Yangi vazifa', 'Новая задача') */
export const L = (uz: string, ru: string) => (cur === 'ru' ? ru : uz);

/** Kirgandan keyin: brauzerda tanlov bo'lmasa, profildagi til olinadi. */
export function syncLang(me: { lang?: Lang; role: string } | null) {
  if (!me) return;
  cur = saved() ?? me.lang ?? cur;
  document.documentElement.lang = cur;
}

/** Tilni almashtirish: profilga yoziladi (bot ham shu tilda yozadi) va sahifa qayta yuklanadi. */
export async function switchLang(next: Lang, save?: (l: Lang) => Promise<unknown>) {
  ls.set(KEY, next);
  if (save) await save(next).catch(() => undefined);
  location.reload();
}
