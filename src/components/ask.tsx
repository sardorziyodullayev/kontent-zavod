// Tasdiqlash va xabar oynalari — brauzerning confirm()/alert() o'rniga: mavzuga mos, ikki tilda,
// Telegram ichida (Mini App) ham bir xil ishlaydi. Ishlatish: if (await ask('O‘chirilsinmi?', { danger: true })) …
import { useSyncExternalStore } from 'react';
import { L } from '@/lib/lang';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';

type Req = { text: string; ok?: string; danger?: boolean; info?: boolean; done: (v: boolean) => void };
let cur: Req | null = null;
const subs = new Set<() => void>();
const set = (r: Req | null) => { cur = r; subs.forEach((f) => f()); };

/** Ha / Yo'q so'rovi. true — tasdiqlandi. */
export const ask = (text: string, o: { ok?: string; danger?: boolean } = {}) => new Promise<boolean>((done) => set({ text, ...o, done }));
/** Bitta tugmali xabar (xato yoki ma'lumot). */
export const tell = (text: string) => new Promise<boolean>((done) => set({ text, info: true, done }));

/** Bir marta qobiqqa qo'yiladi. */
export function AskHost() {
  const r = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur);
  const close = (v: boolean) => { r?.done(v); set(null); };
  return (
    <Modal open={!!r} onClose={() => close(false)} title={r?.info ? L('Xabar', 'Сообщение') : L('Tasdiqlang', 'Подтвердите')} className="w-[min(440px,calc(100vw-32px))]"
      footer={r?.info
        ? <Button variant="primary" onClick={() => close(true)} autoFocus>{L('Tushunarli', 'Понятно')}</Button>
        : <>
            <Button onClick={() => close(false)}>{L('Bekor qilish', 'Отмена')}</Button>
            <Button variant={r?.danger ? 'dark' : 'primary'} className={r?.danger ? 'bg-critical text-white' : undefined} onClick={() => close(true)} autoFocus>{r?.ok ?? L('Ha', 'Да')}</Button>
          </>}>
      <p className="text-[14.5px] leading-relaxed whitespace-pre-line">{r?.text}</p>
    </Modal>
  );
}
