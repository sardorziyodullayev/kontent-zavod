// Profil: Telegram'ni ulash, parolni o'zgartirish, chiqish; admin uchun foydalanuvchilar ro'yxati.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DatabaseBackup, Download, KeyRound, LogOut, Send, Trash2, Upload, UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { Lang, Me, Role } from '@/core/narxtop';
import { apiCall, downloadAuthed, logout, saveToken, useMe } from '@/lib/data';
import { L, lang, switchLang } from '@/lib/lang';
import { cn } from '@/lib/utils';
import { ask, tell } from './ask';
import { BRAND, PixelLogo } from './brand';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { Card, CardHead, Field } from './ui/primitives';

/** UZ | RU almashtirgich. persist: kirgan foydalanuvchi uchun tanlov profilga yoziladi (bot ham shu tilda yozadi). */
export function LangSwitch({ persist = true, className }: { persist?: boolean; className?: string }) {
  const set = (l: Lang) => l !== lang() && switchLang(l, persist ? (x) => apiCall('/me/lang', 'POST', { lang: x }) : undefined);
  return (
    <div role="group" aria-label="Til / Язык" className={cn('inline-flex rounded-full bg-surface-2 p-0.5 text-[12.5px] font-semibold', className)}>
      {(['uz', 'ru'] as const).map((l) => (
        <button key={l} onClick={() => set(l)} aria-pressed={lang() === l} className={cn('rounded-full px-2.5 py-1 text-muted hover:text-ink', lang() === l && 'bg-pill text-pill-ink hover:text-pill-ink')}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

/** Bot havolasini ochadi: foydalanuvchi botda "Start" bossa, Telegram hisobi shu loginga bog'lanadi. */
export function TelegramLink({ compact }: { compact?: boolean }) {
  const qc = useQueryClient();
  const [state, setState] = useState<'idle' | 'wait' | 'err'>('idle');
  const [msg, setMsg] = useState('');
  async function go() {
    setState('wait');
    try {
      const j = await apiCall<{ url: string | null }>('/me/telegram', 'POST', {});
      if (!j.url) { setState('err'); setMsg(L('Bot sozlanmagan (TELEGRAM_BOT_TOKEN yo‘q).', 'Бот не настроен.')); return; }
      window.open(j.url, '_blank', 'noopener');
      setMsg(L('Telegram ochildi: botda “Start” ni bosing. Ulangach, bu yerda belgi o‘zi yangilanadi.', 'Открылся Telegram: нажмите «Start» в боте. После подключения отметка здесь обновится сама.'));
      // ulanishni kutamiz: 2 daqiqa davomida har 4 soniyada tekshiramiz
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const me = await apiCall<Me>('/me');
        if (me.tgLinked) { await qc.invalidateQueries({ queryKey: ['me'] }); setState('idle'); setMsg(''); return; }
      }
      setState('idle');
    } catch (e) { setState('err'); setMsg((e as Error).message); }
  }
  return (
    <div className="grid gap-1.5">
      <Button variant="primary" size={compact ? 'sm' : 'md'} onClick={go} disabled={state === 'wait'}><Send size={15} />{state === 'wait' ? L('Kutilmoqda…', 'Ожидание…') : L('Telegram’ni ulash', 'Подключить Telegram')}</Button>
      {msg && <span className={state === 'err' ? 'text-[12.5px] text-critical-text' : 'text-[12.5px] text-muted'}>{msg}</span>}
    </div>
  );
}

export function ProfileCard() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [pw, setPw] = useState(false);
  if (!me) return null;
  return (
    <Card>
      <CardHead title={L('Mening profilim', 'Мой профиль')} sub={`${me.name} · ${me.login === 'token' ? 'admin token' : me.login}`} right={<LangSwitch />} />
      <div className="grid gap-3">
        {me.via === 'session' ? (
          <div className="flex flex-wrap items-center gap-3">
            {me.tgLinked ? (
              <>
                <span className="inline-flex items-center gap-2 text-[13.5px]"><Send size={15} className="text-accent-text" />{L('Telegram ulangan — vazifalarni botga yuborishingiz mumkin', 'Telegram подключён — задачи можно отправлять боту')}</span>
                <Button size="sm" variant="ghost" onClick={async () => { await apiCall('/me/telegram/unlink', 'POST', {}); qc.invalidateQueries({ queryKey: ['me'] }); }}>{L('Uzish', 'Отключить')}</Button>
              </>
            ) : <TelegramLink />}
          </div>
        ) : <p className="text-[13px] text-muted">Siz admin token bilan kirgansiz. Login va parol yarating (pastda), keyin shu bilan kiring — Telegram’ni ulash ham shunda ochiladi.</p>}
        <div className="flex flex-wrap gap-2">
          {me.via === 'session' && <Button onClick={() => setPw(true)}><KeyRound size={15} />{L('Parolni o‘zgartirish', 'Сменить пароль')}</Button>}
          {me.via !== 'local' && <Button onClick={() => { logout(); location.reload(); }}><LogOut size={15} />{L('Chiqish', 'Выйти')}</Button>}
        </div>
      </div>
      <PasswordModal open={pw} onClose={() => setPw(false)} />
    </Card>
  );
}

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  return (
    <Modal open={open} onClose={() => { onClose(); setErr(''); setOk(false); }} title={L('Parolni o‘zgartirish', 'Сменить пароль')}>
      {ok ? <p className="text-[14px]">{L('✅ Parol o‘zgartirildi. Boshqa qurilmalarda qayta kirish kerak bo‘ladi.', '✅ Пароль изменён. На других устройствах нужно войти заново.')}</p> : (
        <form className="grid gap-3.5" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          if (fd.get('password') !== fd.get('again')) return setErr(L('Yangi parollar bir xil emas', 'Новые пароли не совпадают'));
          try {
            const j = await apiCall<{ token: string }>('/me/password', 'POST', { old: fd.get('old'), password: fd.get('password') });
            saveToken(j.token);
            setOk(true);
          } catch (x) { setErr((x as Error).message); }
        }}>
          <Field label={L('Hozirgi parol', 'Текущий пароль')}><input name="old" type="password" className="input h-11" autoComplete="current-password" required /></Field>
          <Field label={L('Yangi parol (kamida 8 belgi)', 'Новый пароль (минимум 8 символов)')}><input name="password" type="password" className="input h-11" autoComplete="new-password" minLength={8} required /></Field>
          <Field label={L('Yangi parol yana bir marta', 'Повторите новый пароль')}><input name="again" type="password" className="input h-11" autoComplete="new-password" minLength={8} required /></Field>
          {err && <p className="text-[13px] text-critical-text">{err}</p>}
          <Button type="submit" variant="primary" className="h-11 justify-center">{L('Saqlash', 'Сохранить')}</Button>
        </form>
      )}
    </Modal>
  );
}

type UserRow = Me & { createdAt: number };
const ROLE: Record<Role, string> = { admin: 'Admin — butun panel', client: 'Mijoz — faqat Narxtop bo‘limi' };

export function UsersCard() {
  const q = useQuery({ queryKey: ['users'], queryFn: () => apiCall<UserRow[]>('/users') });
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [reset, setReset] = useState<UserRow | null>(null);
  const [err, setErr] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  return (
    <Card>
      <CardHead title="Foydalanuvchilar" sub="login va parol bilan kirish" right={<Button size="sm" variant="primary" onClick={() => { setErr(''); setAdding(true); }}><UserPlus size={14} />Qo‘shish</Button>} />
      {q.error && <p className="text-[13px] text-critical-text">{(q.error as Error).message}</p>}
      <ul className="grid gap-1.5">
        {q.data?.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line px-3 py-2 text-[13.5px]">
            <b className="font-semibold">{u.name}</b>
            <span className="text-muted">{u.login}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-ink-2">{u.role === 'admin' ? 'Admin' : 'Mijoz'} · {u.lang.toUpperCase()}</span>
            {u.tgLinked && <span title="Telegram ulangan"><Send size={13} className="text-accent-text" /></span>}
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setErr(''); setReset(u); }}><KeyRound size={13} />Parol</Button>
              <Button size="icon-sm" variant="danger" aria-label="O‘chirish" onClick={async () => { if (await ask(`${u.name} (${u.login}) o‘chirilsinmi?\nU panelga kira olmaydi.`, { danger: true, ok: 'O‘chirish' })) { await apiCall(`/users/${u.id}`, 'DELETE').catch((e: Error) => tell(e.message)); refresh(); } }}><Trash2 size={14} /></Button>
            </span>
          </li>
        ))}
        {q.data && !q.data.length && <li className="text-[13px] text-muted">Hali foydalanuvchi yo‘q. O‘zingiz (admin) va ish beruvchi (mijoz) uchun login yarating.</li>}
      </ul>
      <Modal open={adding} onClose={() => setAdding(false)} title="Yangi foydalanuvchi">
        <form className="grid gap-3.5" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          try { await apiCall('/users', 'POST', Object.fromEntries(fd)); setAdding(false); refresh(); } catch (x) { setErr((x as Error).message); }
        }}>
          <Field label="Ism (panelda va hisobotda ko‘rinadi)"><input name="name" className="input h-11" placeholder="masalan: Narxtop menejeri" required autoFocus /></Field>
          <Field label="Login (lotin harflari, bo‘sh joysiz)"><input name="login" className="input h-11" autoCapitalize="none" placeholder="narxtop" required /></Field>
          <Field label="Vaqtinchalik parol (kamida 8 belgi)"><input name="password" type="text" className="input h-11" autoComplete="new-password" minLength={8} required /></Field>
          <Field label="Til (panel va bot xabarlari)">
            <select name="lang" className="input h-11" defaultValue="ru">
              <option value="ru">Rus tili</option>
              <option value="uz">O‘zbek tili</option>
            </select>
          </Field>
          <Field label="Huquq">
            <select name="role" className="input h-11" defaultValue="client">
              <option value="client">{ROLE.client}</option>
              <option value="admin">{ROLE.admin}</option>
            </select>
          </Field>
          {err && <p className="text-[13px] text-critical-text">{err}</p>}
          <Button type="submit" variant="primary" className="h-11 justify-center">Yaratish</Button>
          <p className="text-[12.5px] text-muted">Login va vaqtinchalik parolni ish beruvchiga o‘zingiz yuboring. Birinchi kirishda panel undan o‘z parolini qo‘yishni so‘raydi.</p>
        </form>
      </Modal>
      <Modal open={!!reset} onClose={() => setReset(null)} title={`Yangi parol · ${reset?.name ?? ''}`}>
        <form className="grid gap-3.5" onSubmit={async (e) => {
          e.preventDefault();
          try { await apiCall(`/users/${reset!.id}`, 'PATCH', { password: new FormData(e.currentTarget).get('password') }); setReset(null); } catch (x) { setErr((x as Error).message); }
        }}>
          <Field label="Yangi vaqtinchalik parol (kamida 8 belgi)"><input name="password" type="text" className="input h-11" autoComplete="new-password" minLength={8} required autoFocus /></Field>
          {err && <p className="text-[13px] text-critical-text">{err}</p>}
          <Button type="submit" variant="primary" className="h-11 justify-center">Saqlash</Button>
        </form>
      </Modal>
    </Card>
  );
}

/** Parol admin tomonidan berilgan: panelga kirishdan oldin foydalanuvchi o'z parolini qo'yadi. */
export function ForcePassword({ name }: { name: string }) {
  const qc = useQueryClient();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form className="card grid w-full max-w-[420px] gap-4 p-6 sm:p-7" onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (fd.get('password') !== fd.get('again')) return setErr(L('Yangi parollar bir xil emas', 'Новые пароли не совпадают'));
        setBusy(true);
        try {
          const j = await apiCall<{ token: string }>('/me/password', 'POST', { old: fd.get('old'), password: fd.get('password') });
          saveToken(j.token);
          await qc.resetQueries();
        } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
      }}>
        <div className="flex items-center gap-3">
          <PixelLogo size={46} />
          <div className="min-w-0">
            <h1 className="font-display text-[18px] font-semibold tracking-[-0.02em]">{L('O‘z parolingizni qo‘ying', 'Задайте свой пароль')}</h1>
            <p className="text-[13px] text-muted">{name} · {BRAND.product}</p>
          </div>
          <LangSwitch className="ml-auto self-start" />
        </div>
        <p className="rounded-xl bg-accent-wash px-3 py-2 text-[13px] text-accent-text">{L('Sizga vaqtinchalik parol berilgan. Davom etish uchun faqat o‘zingiz biladigan yangi parol qo‘ying.', 'Вам выдан временный пароль. Чтобы продолжить, задайте новый пароль, который знаете только вы.')}</p>
        <Field label={L('Vaqtinchalik parol', 'Временный пароль')}><input name="old" type="password" className="input h-12" autoComplete="current-password" required autoFocus /></Field>
        <Field label={L('Yangi parol (kamida 8 belgi)', 'Новый пароль (минимум 8 символов)')}><input name="password" type="password" className="input h-12" autoComplete="new-password" minLength={8} required /></Field>
        <Field label={L('Yangi parol yana bir marta', 'Повторите новый пароль')}><input name="again" type="password" className="input h-12" autoComplete="new-password" minLength={8} required /></Field>
        {err && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-critical-text" role="alert">{err}</p>}
        <Button type="submit" variant="primary" className="h-12 justify-center text-[15px]" disabled={busy}>{L('Saqlash va kirish', 'Сохранить и войти')}</Button>
        <button type="button" className="text-center text-[12.5px] text-muted underline underline-offset-2 hover:text-ink" onClick={() => { logout(); location.reload(); }}>{L('Chiqish', 'Выйти')}</button>
      </form>
    </main>
  );
}

/** Narxtop zaxira nusxasi: oylar, vazifalar (arxiv bilan) va to'lovlar bitta JSON faylda. Faqat admin. */
export function BackupCard() {
  const qc = useQueryClient();
  return (
    <Card>
      <CardHead title="Narxtop zaxira nusxasi" sub="oylar, vazifalar, to‘lovlar" />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => downloadAuthed('/narxtop/backup.json', 'narxtop-zaxira.json').catch((e: Error) => tell(e.message))}><Download size={16} />Zaxirani yuklab olish</Button>
        <label className="inline-flex h-10 cursor-pointer items-center gap-[7px] rounded-full border border-line bg-surface px-4 font-medium hover:bg-surface-2">
          <Upload size={16} />Zaxiradan tiklash
          <input type="file" accept="application/json" hidden onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const data = JSON.parse(await file.text()) as { kind?: string; periods?: unknown[]; orders?: unknown[]; payments?: unknown[]; exportedAt?: number };
              if (data.kind !== 'narxtop-backup') throw new Error('Bu Narxtop zaxira fayli emas');
              const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString('ru-RU') : '—';
              if (!(await ask(`Zaxiradan tiklansinmi?\n\nFayl: ${when}\n${data.periods?.length ?? 0} oy, ${data.orders?.length ?? 0} vazifa, ${data.payments?.length ?? 0} to‘lov.\n\nHozirgi Narxtop ma’lumotlari shu fayldagilar bilan ALMASHTIRILADI.`, { danger: true, ok: 'Almashtirish' }))) return;
              const r = await apiCall<{ orders: number }>('/narxtop/restore', 'POST', data);
              await qc.invalidateQueries({ queryKey: ['narxtop'] });
              await tell(`Tiklandi: ${r.orders} ta vazifa.`);
            } catch (x) { await tell((x as Error).message); }
          }} />
        </label>
      </div>
      <p className="mt-3 flex items-start gap-2 text-[12.5px] text-muted"><DatabaseBackup size={15} className="mt-px shrink-0" />Oyda bir marta (yoki oy yopilganda) zaxirani yuklab, kompyuter yoki Google Drive’da saqlang. Baza bilan muammo bo‘lsa, shu fayldan tiklanadi.</p>
    </Card>
  );
}
