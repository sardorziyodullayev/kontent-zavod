// Interfeys holati (drawer, modal, filtrlar) — kichik tashqi store, useSyncExternalStore orqali.
import { useSyncExternalStore } from 'react';
import type { PlatformId } from '@/core';
import { ls } from './utils';

export type Modal = { type: 'new' } | { type: 'schedule'; date?: number; videoId?: string } | null;
export type Period = 7 | 30 | 90;

interface UI {
  drawer: { id: string; section?: 'script' | 'ready' } | null;
  modal: Modal;
  palette: boolean;
  menu: boolean;
  period: Period;
  pf: 'all' | PlatformId;
  hidden: Record<string, boolean>;
  theme: 'dark' | 'light';
}

let state: UI = {
  drawer: null, modal: null, palette: false, menu: false, period: 30, pf: 'all', hidden: {},
  theme: (document.documentElement.dataset.theme as 'dark' | 'light') ?? 'dark',
};
const subs = new Set<() => void>();

export function setUI(patch: Partial<UI> | ((s: UI) => Partial<UI>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach((f) => f());
}
export function useUI<T>(sel: (s: UI) => T): T {
  return useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => sel(state));
}

export const openVideo = (id: string, section?: 'script' | 'ready') => setUI({ drawer: { id, section }, palette: false });
export const openModal = (modal: Modal) => setUI({ modal, palette: false });
export const pfList = (pf: UI['pf'], all: PlatformId[]) => (pf === 'all' ? all : [pf]);

export function setTheme(t: 'dark' | 'light' | 'system') {
  ls.set('kz-theme', t);
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  setUI({ theme: dark ? 'dark' : 'light' });
}
