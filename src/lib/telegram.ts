// Telegram Mini App: panel bot tugmasidan Telegram ichida ochilganda — skript yuklanadi, initData orqali parolsiz kirish,
// mavzu Telegram'dan, "Orqaga" tugmasi ochiq oynani yopadi. Oddiy brauzerda hech narsa yuklanmaydi.
import { lang } from './lang';
import { setUI } from './ui';
import { ls } from './utils';

type BackButton = { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
export type WebApp = {
  initData: string; colorScheme?: 'light' | 'dark'; platform?: string;
  ready(): void; expand(): void; BackButton?: BackButton; HapticFeedback?: { notificationOccurred(t: 'success' | 'error' | 'warning'): void };
};
declare global { interface Window { Telegram?: { WebApp?: WebApp } } }

const SCRIPT = 'https://telegram.org/js/telegram-web-app.js';

/** Telegram ichida ochilganmi (skript yuklanmasdan oldingi taxmin): manzilda tgWebAppData, sessiyada Telegram parametrlari yoki user-agent. */
export function tgHint(): boolean {
  try {
    if (/tgWebApp(Data|Platform|Version)=/.test(location.hash)) return true;
    if (sessionStorage.getItem('__telegram__initParams')?.includes('tgWebAppData')) return true;
  } catch { /* sessionStorage yopiq */ }
  return /\bTelegram/i.test(navigator.userAgent);
}

let app: WebApp | null = null;
/** Mini App ichidami (initData bor). */
export const tgApp = (): WebApp | null => app;
export const inTelegram = () => !!app;

function loadScript(): Promise<void> {
  if (window.Telegram?.WebApp) return Promise.resolve();
  return new Promise((ok) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.onload = () => ok();
    s.onerror = () => ok();
    document.head.appendChild(s);
    setTimeout(ok, 5000); // Telegram serveri sekin bo'lsa ham panel ochilsin
  });
}

/** Kirish natijasi: Login oynasi shu xabarni ko'rsatadi (masalan, Telegram ulanmagan). */
export let tgNotice = '';

/**
 * Ilova chizilishidan oldin chaqiriladi. Telegram ichida: skript, ready/expand, mavzu va initData → sessiya tokeni.
 * Saqlangan token boshqa odamniki bo'lsa ham Telegram akkaunti ustun turadi; ulanmagan bo'lsa eski token qoladi.
 */
export async function bootTelegram(): Promise<void> {
  if (!tgHint()) return;
  await loadScript();
  const wa = window.Telegram?.WebApp;
  if (!wa?.initData) return;
  app = wa;
  try { wa.ready(); wa.expand(); } catch { /* eski Telegram versiyasi */ }
  if (wa.colorScheme) { document.documentElement.dataset.theme = wa.colorScheme; setUI({ theme: wa.colorScheme }); }
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}api/auth/telegram`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Lang': lang() }, body: JSON.stringify({ initData: wa.initData }) });
    const j = await r.json().catch(() => ({})) as { token?: string; error?: string };
    if (r.ok && j.token) ls.set('kz-token', j.token);
    else tgNotice = j.error ?? '';
  } catch { /* tarmoq xatosi: oddiy kirish oynasi */ }
}

/** Telegram "Orqaga" tugmasi: ochiq oyna (vazifa paneli) bo'lsa ko'rinadi va uni yopadi. */
export function telegramBack(active: boolean, onBack: () => void) {
  // useEffect ichida chaqiriladi; tozalash funksiyasini qaytaradi.
  const bb = app?.BackButton;
  if (!bb || !active) return () => undefined;
  bb.onClick(onBack);
  bb.show();
  return () => { bb.offClick(onBack); bb.hide(); };
}
