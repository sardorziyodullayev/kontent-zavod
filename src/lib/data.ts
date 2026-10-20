// Ma'lumot qatlami: server bo'lsa API, bo'lmasa (GitHub Pages) brauzer xotirasidagi demo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { applyAction, seed, tick, type Action, type State } from '@/core';
import { ls } from './utils';

export type Mode = 'server' | 'demo';
export interface AppData { mode: Mode; state: State }

const LS_STATE = 'kz-state-v2';
const LS_TOKEN = 'kz-token';
const API = `${import.meta.env.BASE_URL}api`;

function loadDemo(): AppData {
  let s: State | null = null;
  try { s = JSON.parse(ls.get(LS_STATE) ?? 'null'); } catch { /* buzilgan */ }
  if (!s || s.version !== 1 || !Array.isArray(s.videos)) s = seed(Date.now());
  tick(s, Date.now());
  ls.set(LS_STATE, JSON.stringify(s));
  return { mode: 'demo', state: s };
}

/** Server ADMIN_TOKEN so'rayapti: panel kirish oynasini ko'rsatadi. */
export class AuthError extends Error {
  constructor(message = 'Kirish kerak') { super(message); }
}

const authHeader = (): Record<string, string> => {
  const tok = ls.get(LS_TOKEN);
  return tok ? { Authorization: `Bearer ${tok}` } : {};
};

export const saveToken = (t: string) => ls.set(LS_TOKEN, t.trim());
export const logout = () => ls.del(LS_TOKEN);

let detected: Mode | null = null;
async function fetchState(): Promise<AppData> {
  if (detected !== 'demo') {
    // 404 yoki JSON bo'lmagan javob — statik hosting (demo). Tarmoq xatosi/5xx — server hali ishga tushmoqda, qayta urinamiz.
    for (let attempt = 0; attempt < 5; attempt++) {
      let transient = false;
      try {
        const r = await fetch(`${API}/state`, { cache: 'no-store', headers: authHeader() });
        if (r.status === 401) { detected = 'server'; throw new AuthError(ls.get(LS_TOKEN) ? 'Token noto‘g‘ri' : undefined); }
        transient = r.status >= 500;
        const j = r.ok ? await r.json().catch(() => null) : null;
        if (j?.mode === 'server') { detected = 'server'; return { mode: 'server', state: j.state }; }
      } catch (e) {
        if (e instanceof AuthError) throw e;
        transient = true;
      }
      if (!transient) break;
      await new Promise((ok) => setTimeout(ok, 800));
    }
    if (detected === 'server') throw new Error('Server bilan aloqa uzildi');
    detected = 'demo';
  }
  return loadDemo();
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(body) });
  if (r.status === 401) { logout(); location.reload(); throw new AuthError('Sessiya tugadi, qayta kiring'); }
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? 'Xato');
  return j;
}

export const useAppData = () =>
  useQuery({ queryKey: ['state'], queryFn: fetchState, retry: (n, e) => !(e instanceof AuthError) && n < 3, refetchInterval: 60_000, staleTime: 20_000, refetchOnWindowFocus: true });

/** Amal bajaradi va yangi holatni keshga yozadi. Natija (masalan yangi video) qaytariladi. */
export function useAct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: Action): Promise<{ data: AppData; result: unknown }> => {
      const cur = qc.getQueryData<AppData>(['state']);
      if (cur?.mode === 'server') {
        const j = await request<{ state: State; result: unknown }>('/action', action);
        return { data: { mode: 'server', state: j.state }, result: j.result };
      }
      const s = structuredClone(cur?.state ?? loadDemo().state);
      tick(s, Date.now());
      const result = applyAction(s, action, Date.now());
      ls.set(LS_STATE, JSON.stringify(s));
      return { data: { mode: 'demo', state: s }, result };
    },
    onSuccess: ({ data }) => qc.setQueryData(['state'], data),
  });
}

export function useReplaceState() {
  const qc = useQueryClient();
  return async (next: State | 'reset') => {
    const cur = qc.getQueryData<AppData>(['state']);
    if (cur?.mode === 'server') {
      if (next === 'reset') await request('/reset', {});
      else await request('/import', next);
      await qc.invalidateQueries({ queryKey: ['state'] });
    } else {
      const s = next === 'reset' ? seed(Date.now()) : tick(next, Date.now());
      ls.set(LS_STATE, JSON.stringify(s));
      qc.setQueryData(['state'], { mode: 'demo', state: s });
    }
  };
}

/** Hozirgi vaqt, berilgan oraliqda yangilanadi. */
export function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
