import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { saveToken } from '@/lib/data';
import { BRAND, PixelLogo } from './brand';
import { Button } from './ui/button';

/** Server ADMIN_TOKEN bilan himoyalangan bo'lsa ko'rinadi. Token brauzerda (localStorage) saqlanadi. */
export function Login({ message }: { message?: string }) {
  const qc = useQueryClient();
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    saveToken(token);
    await qc.resetQueries({ queryKey: ['state'] });
    setBusy(false);
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="card grid w-full max-w-[380px] gap-4 p-6">
        <div className="flex items-center gap-2.5">
          <PixelLogo size={44} />
          <div>
            <h1 className="font-display text-[18px] font-semibold tracking-[-0.02em]">{BRAND.product}</h1>
            <p className="text-[12.5px] text-muted">{BRAND.tagline} · panelga kirish</p>
          </div>
        </div>
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-ink-2">Admin token</span>
          <input className="input" type="password" autoComplete="current-password" autoFocus value={token} onChange={(e) => setToken(e.target.value)} placeholder="ADMIN_TOKEN" />
        </label>
        {message && message !== 'Kirish kerak' && <p className="text-[13px] text-critical-text">{message}</p>}
        <Button type="submit" variant="primary" className="justify-center" disabled={busy || !token.trim()}>{busy ? 'Tekshirilmoqda…' : 'Kirish'}</Button>
        <p className="text-xs text-muted">Token serverdagi <code>ADMIN_TOKEN</code> o‘zgaruvchisida turadi.</p>
      </form>
    </main>
  );
}
