import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { loginWithPassword, saveToken } from '@/lib/data';
import { BRAND, PixelLogo } from './brand';
import { Button } from './ui/button';

/** Kirish: login va parol. Admin uchun zaxira yo'l — ADMIN_TOKEN (kichik havola orqali). */
export function Login({ message }: { message?: string }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'password' | 'token'>('password');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (mode === 'password') await loginWithPassword(login, password);
      else saveToken(token);
      await qc.resetQueries();
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const shown = err || (message && message !== 'Kirish kerak' ? message : '');
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="card grid w-full max-w-[400px] gap-4 p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <PixelLogo size={46} />
          <div>
            <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em]">{BRAND.product}</h1>
            <p className="text-[13px] text-muted">Panelga kirish</p>
          </div>
        </div>
        {mode === 'password' ? (
          <>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Login</span>
              <input className="input h-12 text-[15px]" autoComplete="username" autoCapitalize="none" autoFocus value={login} onChange={(e) => setLogin(e.target.value)} placeholder="masalan: narxtop" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Parol</span>
              <input className="input h-12 text-[15px]" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          </>
        ) : (
          <label className="grid gap-1.5">
            <span className="text-[13px] font-medium text-ink-2">Admin token</span>
            <input className="input h-12" type="password" autoComplete="off" autoFocus value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" />
          </label>
        )}
        {shown && <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-critical-text" role="alert">{shown}</p>}
        <Button type="submit" variant="primary" className="h-12 justify-center text-[15px]" disabled={busy || (mode === 'password' ? !login.trim() || !password : !token.trim())}>
          {busy ? 'Tekshirilmoqda…' : 'Kirish'}
        </Button>
        <p className="text-center text-[12.5px] text-muted">
          {mode === 'password' ? 'Login yoki parolni unutdingizmi? Admin (Sardor)ga yozing.' : 'Token serverdagi ADMIN_TOKEN o‘zgaruvchisida.'}
          {' '}
          <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => { setErr(''); setMode(mode === 'password' ? 'token' : 'password'); }}>
            {mode === 'password' ? 'Token bilan kirish' : 'Login va parol bilan kirish'}
          </button>
        </p>
      </form>
    </main>
  );
}
