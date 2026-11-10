import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Menu, Moon, Plus, Search, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { alerts, localHour } from '@/core';
import { AuthError, useAppData, useMe, useNow, type AppData, type MeInfo } from '@/lib/data';
import { NarxtopPage } from '@/pages/narxtop';
import { L, syncLang } from '@/lib/lang';
import { LangSwitch, ProfileCard } from './profile';
import { Modal } from './ui/dialog';
import { openModal, setTheme, setUI, useUI } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { CommandPalette } from './command-palette';
import { Dialogs } from './dialogs';
import { Login } from './login';
import { AutopilotBadge } from './factory-now';
import { NAV } from './nav';
import { BRAND, PixelLogo } from './brand';
import { Button } from './ui/button';
import { VideoSheet } from './video-sheet';

function Sidebar({ data }: { data: AppData }) {
  const menu = useUI((s) => s.menu);
  const now = useNow(60_000);
  const crit = alerts(data.state, now).filter((a) => a.level === 'critical').length;
  return (
    <aside className={cn('fixed top-0 z-[60] flex h-screen w-[264px] duration-300 ease-out md:z-10 flex-col gap-1 rounded-r-[26px] bg-surface px-3.5 py-5 shadow-pop transition-transform md:sticky md:top-4 md:m-4 md:mr-0 md:h-[calc(100vh-2rem)] md:w-auto md:translate-x-0 md:rounded-[26px] md:border md:border-[var(--card-border)] md:shadow-card', menu ? 'translate-x-0' : '-translate-x-full')} aria-label="Asosiy menyu">
      <Link to="/" className="flex items-center gap-3 px-2 pt-0.5 pb-5">
        <PixelLogo size={38} />
        <span className="min-w-0">
          <span className="block truncate font-display text-[16.5px] leading-tight font-semibold tracking-[-0.02em]">{data.state.workspace.name}</span>
          <span className="text-[11.5px] text-muted">{BRAND.tagline}</span>
        </span>
      </Link>
      <nav className="grid min-h-0 gap-1 overflow-y-auto">
        {NAV.map((n, i) => (
          <div key={n.to}>
            {(i === 0 || NAV[i - 1].group !== n.group) && <div className={cn('px-3 pb-2 text-[12px] font-medium text-muted', i > 0 && 'mt-4')}>{n.group}</div>}
            <Link to={n.to} onClick={() => setUI({ menu: false })} activeOptions={{ exact: n.to === '/' }}
              className="group flex items-center gap-3 rounded-[14px] px-3 py-[10px] font-medium text-ink-2 transition-[background-color,color,transform] duration-200 hover:translate-x-0.5 hover:bg-surface-2 hover:text-ink data-[status=active]:bg-accent data-[status=active]:font-semibold data-[status=active]:text-accent-ink">
              <n.icon size={18} strokeWidth={1.9} className="transition-transform duration-300 group-hover:scale-110 group-data-[status=active]:scale-110" />
              {n.name}
              {n.to === '/' && crit > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-critical px-1.5 text-[11px] font-bold text-white" title="Muhim ogohlantirishlar">{crit}</span>}
            </Link>
          </div>
        ))}
      </nav>
      <div className="mt-auto pt-3">
        <AutopilotBadge data={data} />
      </div>
    </aside>
  );
}

/** Kim kirganiga qarab: mijoz — faqat Narxtop bo'limi, admin — butun panel. */
export function Shell() {
  const me = useMe();
  if (me.error instanceof AuthError) return <Login message={me.error.message} />;
  if (me.isLoading) return <div className="p-10 text-muted">{L('Yuklanmoqda…', 'Загрузка…')}</div>;
  syncLang(me.data ?? null);
  if (me.data?.role === 'client') return <ClientShell me={me.data} />;
  return <AdminShell me={me.data ?? null} />;
}

export function NarxtopRoute() {
  const { data } = useMe();
  return <NarxtopPage me={data ?? null} />;
}

/** Ish beruvchi uchun: menyusiz, bitta sahifa — Narxtop vazifalari. */
function ClientShell({ me }: { me: MeInfo }) {
  const theme = useUI((s) => s.theme);
  const [profile, setProfile] = useState(false);
  useEffect(() => { document.title = `Narxtop · ${BRAND.product}`; }, []);
  return (
    <div className="mx-auto min-h-screen max-w-[1400px] px-3 md:px-6">
      <header className="sticky top-0 z-20 -mx-3 bg-gradient-to-b from-page via-page/90 to-transparent px-3 pt-3 pb-2 md:mx-0 md:px-0 md:pt-4">
        <div className="flex items-center gap-3 rounded-[22px] border border-[var(--card-border)] bg-surface py-2.5 pr-2.5 pl-3 shadow-card md:py-3 md:pl-4">
          <PixelLogo size={38} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-[17px] font-semibold tracking-[-0.02em] sm:text-[20px]">Narxtop</h1>
            <div className="hidden truncate text-[12.5px] text-muted sm:block">{L('AI videolar: vazifalar, holat va hisobot', 'AI-видео: задачи, статусы и отчёт')} · {BRAND.name}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LangSwitch />
            <Button size="icon" className="max-sm:hidden" aria-label="Mavzuni almashtirish" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</Button>
            <button className="flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 hover:bg-surface-2" onClick={() => setProfile(true)} aria-label="Profil">
              <span className="grid size-9 place-items-center rounded-full bg-pill font-display text-[14px] font-semibold text-pill-ink">{me.name[0]?.toUpperCase()}</span>
              <span className="hidden text-left leading-tight sm:block"><b className="block text-[13px] font-semibold">{me.name}</b><span className="text-[11.5px] text-muted">{L('Profil va chiqish', 'Профиль и выход')}</span></span>
            </button>
          </div>
        </div>
      </header>
      <main className="pt-3 pb-16 md:pt-4"><NarxtopPage me={me} /></main>
      <Modal open={profile} onClose={() => setProfile(false)} title={L('Profil', 'Профиль')}><ProfileCard /></Modal>
    </div>
  );
}

function AdminShell({ me }: { me: MeInfo | null }) {
  const { data, error, isLoading } = useAppData();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const menu = useUI((s) => s.menu);
  const theme = useUI((s) => s.theme);
  const page = NAV.find((n) => n.to === path) ?? NAV[0];
  const h = localHour(Date.now());
  const title = page.to === '/' ? `${h < 11 ? 'Xayrli tong' : h < 18 ? 'Xayrli kun' : 'Xayrli kech'}, ${BRAND.owner}` : page.name;
  useEffect(() => { document.title = `${page.name} · ${data?.state.workspace.name ?? BRAND.product}`; }, [page, data?.state.workspace.name]);

  if (!data) return isLoading ?<div className="p-10 text-muted">Yuklanmoqda…</div> : <div className="p-10 text-critical-text">Ma’lumot yuklanmadi: {String(error)}</div>;

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[264px_minmax(0,1fr)]">
      <Sidebar data={data} />
      {menu && <div className="fixed inset-0 z-[55] bg-black/50 md:hidden" onClick={() => setUI({ menu: false })} />}
      <div className="min-w-0 px-3 md:px-6">
        <header className="sticky top-0 z-20 -mx-3 bg-gradient-to-b from-page via-page/90 to-transparent px-3 pt-3 pb-2 md:mx-0 md:px-0 md:pt-4">
          <div className="flex items-center gap-3 rounded-[22px] border border-[var(--card-border)] bg-surface py-2.5 pr-2.5 pl-3 shadow-card md:py-3 md:pl-5">
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menyu" onClick={() => setUI({ menu: true })}><Menu size={18} /></Button>
            <div className="min-w-0">
              <h1 className="truncate font-display text-[16px] font-semibold tracking-[-0.02em] sm:text-[20px]">{title}</h1>
              <div className="hidden truncate text-[12.5px] text-muted sm:block">{page.sub}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button className="flex size-10 items-center gap-2.5 rounded-full bg-surface-2 text-muted hover:text-ink max-lg:justify-center lg:h-11 lg:w-[260px] lg:px-4" onClick={() => setUI({ palette: true })} aria-label="Qidirish">
                <span className="hidden text-[13px] lg:inline">Qidirish yoki buyruq…</span>
                <span className="ml-auto hidden rounded-md bg-surface px-1.5 text-[11px] leading-5 lg:inline">Ctrl K</span>
                <Search size={17} className="max-lg:mx-auto" />
              </button>
              <Button size="icon" className="max-sm:hidden md:size-11" aria-label="Mavzuni almashtirish" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</Button>
              {path !== '/narxtop' && <Button variant="primary" className="max-sm:w-10 max-sm:justify-center max-sm:px-0 md:h-11" onClick={() => openModal({ type: 'new' })} aria-label="Yangi video"><Plus size={17} /><span className="hidden sm:inline">Yangi video</span></Button>}
              <div className="ml-1 hidden items-center gap-2.5 border-l border-line pl-3 xl:flex">
                <span className="grid size-10 place-items-center rounded-full bg-pill font-display text-[14px] font-semibold text-pill-ink">{(me?.name && me.via === 'session' ? me.name : BRAND.owner)[0]}</span>
                <span className="leading-tight"><b className="block text-[13px] font-semibold">{me?.name && me.via === 'session' ? me.name : BRAND.owner}</b><span className="text-[11.5px] text-muted">{BRAND.handle}</span></span>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-[1480px] pt-3 pb-16 md:pt-4"><Outlet /></main>
      </div>
      <VideoSheet state={data.state} />
      <Dialogs state={data.state} />
      <CommandPalette state={data.state} />
    </div>
  );
}

/** Sahifalar holatni shu hook orqali oladi (Shell uni yuklab bo'lgan). */
export function useAppState() {
  const { data } = useAppData();
  return data!;
}
