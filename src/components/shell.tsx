import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Menu, Moon, Plus, Search, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { alerts } from '@/core';
import { AuthError, useAppData, useNow, type AppData } from '@/lib/data';
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
    <aside className={cn('fixed top-0 z-[60] flex h-screen w-[260px] flex-col gap-1 border-r border-line bg-surface px-3 py-[18px] shadow-pop transition-transform md:sticky md:w-auto md:translate-x-0 md:bg-page md:shadow-none', menu ? 'translate-x-0' : '-translate-x-full')} aria-label="Asosiy menyu">
      <Link to="/" className="flex items-center gap-3 px-2.5 pt-1 pb-[18px]">
        <PixelLogo size={34} />
        <span>
          <span className="block font-display text-[16px] leading-tight font-semibold tracking-[-0.02em]">{data.state.workspace.name}</span>
          <span className="text-[11.5px] text-muted">{BRAND.tagline}</span>
        </span>
      </Link>
      <nav className="grid gap-0.5">
        {NAV.map((n, i) => (
          <div key={n.to}>
            {(i === 0 || NAV[i - 1].group !== n.group) && <div className={cn('px-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.12em] text-muted uppercase', i > 0 && 'mt-4')}>{n.group}</div>}
            <Link to={n.to} onClick={() => setUI({ menu: false })} activeOptions={{ exact: n.to === '/' }}
              className="group relative flex items-center gap-[11px] rounded-[9px] px-2.5 py-[9px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink data-[status=active]:bg-surface-2 data-[status=active]:text-ink">
              <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-accent opacity-0 group-data-[status=active]:opacity-100" />
              <n.icon size={18} className="group-data-[status=active]:text-accent-text" />
              {n.name}
              {n.to === '/' && crit > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-critical px-1.5 text-[11px] font-bold text-white" title="Muhim ogohlantirishlar">{crit}</span>}
            </Link>
          </div>
        ))}
      </nav>
      <div className="mt-auto px-1">
        <AutopilotBadge data={data} />
      </div>
    </aside>
  );
}

export function Shell() {
  const { data, error, isLoading } = useAppData();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const menu = useUI((s) => s.menu);
  const theme = useUI((s) => s.theme);
  const page = NAV.find((n) => n.to === path) ?? NAV[0];
  useEffect(() => { document.title = `${page.name} · ${data?.state.workspace.name ?? BRAND.product}`; }, [page, data?.state.workspace.name]);

  if (error instanceof AuthError) return <Login message={error.message} />;
  if (!data) return isLoading ?<div className="p-10 text-muted">Yuklanmoqda…</div> : <div className="p-10 text-critical-text">Ma’lumot yuklanmadi: {String(error)}</div>;

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[236px_minmax(0,1fr)]">
      <Sidebar data={data} />
      {menu && <div className="fixed inset-0 z-[55] bg-black/50 md:hidden" onClick={() => setUI({ menu: false })} />}
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-page/85 px-4 py-3 backdrop-blur-md md:px-7 md:py-3.5">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menyu" onClick={() => setUI({ menu: true })}><Menu size={18} /></Button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-semibold tracking-[-0.015em] sm:text-[19px]">{page.name}</h1>
            <div className="hidden text-[12.5px] text-muted sm:block">{page.sub}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button className="text-muted md:min-w-[220px]" onClick={() => setUI({ palette: true })} aria-label="Qidirish">
              <Search size={16} /><span className="hidden md:inline">Qidirish yoki buyruq</span>
              <span className="ml-auto hidden rounded-[5px] border border-line-2 px-[5px] text-[11px] leading-[18px] md:inline">Ctrl K</span>
            </Button>
            <Button variant="ghost" size="icon" aria-label="Mavzuni almashtirish" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</Button>
            <Button variant="primary" onClick={() => openModal({ type: 'new' })}><Plus size={16} /><span className="hidden sm:inline">Yangi video</span></Button>
          </div>
        </header>
        <main className="max-w-[1480px] px-4 pt-4 pb-16 md:px-7 md:pt-6"><Outlet /></main>
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
