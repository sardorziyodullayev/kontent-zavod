// Ma'lumot qatlami: server bo'lsa API, bo'lmasa (GitHub Pages) brauzer xotirasidagi demo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { applyAction, emptyState, seed, tick, type Action, type State } from '@/core';
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
  return async (next: State | 'reset' | 'empty') => {
    const cur = qc.getQueryData<AppData>(['state']);
    if (cur?.mode === 'server') {
      if (next === 'reset' || next === 'empty') await request('/reset', { empty: next === 'empty' });
      else await request('/import', next);
      await qc.invalidateQueries({ queryKey: ['state'] });
    } else {
      const s = next === 'reset' ? seed(Date.now()) : next === 'empty' ? emptyState(Date.now(), cur?.state) : tick(next, Date.now());
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

// ---------- video fayllar (faqat server rejimida) ----------
export interface MediaInfo { videoId: string; name: string; size: number; uploadedAt: number }

export function useMedia(enabled: boolean) {
  return useQuery({
    queryKey: ['media'], enabled, refetchInterval: 60_000,
    queryFn: async (): Promise<MediaInfo[]> => {
      const r = await fetch(`${API}/media`, { headers: authHeader(), cache: 'no-store' });
      if (!r.ok) throw new Error('Fayllar ro‘yxati olinmadi');
      return r.json();
    },
  });
}

/** Faylni serverga yuklaydi; onProgress 0..1. XHR — fetch yuklash foizini bermaydi. */
export function uploadMedia(videoId: string, file: File, onProgress: (p: number) => void) {
  return new Promise<MediaInfo>((ok, fail) => {
    const x = new XMLHttpRequest();
    x.open('PUT', `${API}/media/${videoId}`);
    for (const [k, v] of Object.entries(authHeader())) x.setRequestHeader(k, v);
    x.setRequestHeader('Content-Type', file.type || 'video/mp4');
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      let j: { error?: string } & Partial<MediaInfo> = {};
      try { j = JSON.parse(x.responseText); } catch { /* bo'sh javob */ }
      if (x.status >= 200 && x.status < 300) ok(j as MediaInfo);
      else fail(new Error(j.error ?? `Yuklanmadi (${x.status})`));
    };
    x.onerror = () => fail(new Error('Tarmoq xatosi'));
    x.send(file);
  });
}

export async function deleteMedia(videoId: string) {
  const r = await fetch(`${API}/media/${videoId}`, { method: 'DELETE', headers: authHeader() });
  if (!r.ok) throw new Error('O‘chirilmadi');
}
