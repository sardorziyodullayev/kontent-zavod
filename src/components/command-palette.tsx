// Ctrl+K buyruqlar palitrasi (cmdk).
import { Command } from 'cmdk';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { stageName, toCSV, type State } from '@/core';
import { openModal, openVideo, setTheme, setUI, useUI } from '@/lib/ui';
import { download, today } from '@/lib/utils';
import { NAV } from './nav';

export function CommandPalette({ state }: { state: State }) {
  const open = useUI((s) => s.palette);
  const theme = useUI((s) => s.theme);
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement | null)?.tagName ?? '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setUI((s) => ({ palette: !s.palette })); }
      else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'n' && !document.querySelector('[role=dialog]')) { e.preventDefault(); openModal({ type: 'new' }); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
  const run = (fn: () => void) => { setUI({ palette: false }); fn(); };
  const item = 'flex cursor-pointer items-center gap-2.5 rounded-[9px] px-3 py-[9px] data-[selected=true]:bg-surface-2';
  return (
    <Command.Dialog open={open} onOpenChange={(o) => setUI({ palette: o })} label="Buyruqlar" overlayClassName="fixed inset-0 z-50 bg-black/50"
      contentClassName="fixed top-[14vh] left-1/2 z-50 w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
      <Command.Input placeholder="Sahifa, video yoki amal…" className="w-full border-b border-line bg-transparent px-5 py-4 text-base outline-none" />
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-4 text-muted">Hech narsa topilmadi</Command.Empty>
        <Command.Group heading="Sahifalar" className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          {NAV.map((n) => (
            <Command.Item key={n.to} value={n.name} className={`${item} text-sm text-ink`} onSelect={() => run(() => navigate({ to: n.to }))}>
              <n.icon size={16} className="text-muted" />{n.name}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Amallar" className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          <Command.Item className={`${item} text-sm text-ink`} onSelect={() => run(() => openModal({ type: 'new' }))}>Yangi video yaratish<span className="ml-auto text-xs text-muted">N</span></Command.Item>
          <Command.Item className={`${item} text-sm text-ink`} onSelect={() => run(() => openModal({ type: 'schedule' }))}>Video rejalashtirish</Command.Item>
          <Command.Item className={`${item} text-sm text-ink`} onSelect={() => run(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}>Mavzuni almashtirish (qorong‘i / yorug‘)</Command.Item>
          <Command.Item className={`${item} text-sm text-ink`} onSelect={() => run(() => download(`kontent-zavod-${today()}.csv`, '﻿' + toCSV(state, Date.now()), 'text/csv;charset=utf-8'))}>CSV eksport</Command.Item>
        </Command.Group>
        <Command.Group heading="Videolar" className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5">
          {state.videos.map((v) => (
            <Command.Item key={v.id} value={`${v.title} ${v.id}`} className={`${item} text-sm text-ink`} onSelect={() => run(() => openVideo(v.id))}>
              <span className="truncate">{v.title}</span><span className="ml-auto shrink-0 text-xs text-muted">{stageName(v.status)}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
