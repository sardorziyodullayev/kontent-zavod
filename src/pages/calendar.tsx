import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import {
  DAY, DOW_NAMES, HOUR, MONTHS_FULL, PLATFORMS, TZ_OFFSET, allPosts, bestDay, bestSlots, dayStart, fmtDate, fmtTime, local, localDow, pname, readiness, slotLabel,
  type Post, type Video,
} from '@/core';
import { Pf, pcolor } from '@/components/bits';
import { useAppState } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardHead, Meter, Tag } from '@/components/ui/primitives';
import { useNow } from '@/lib/data';
import { openModal, openVideo } from '@/lib/ui';
import { cn } from '@/lib/utils';

type Ev = { v: Video; at: number; posts: Post[] };

export function CalendarPage() {
  const { state } = useAppState();
  const now = useNow(60_000);
  const [ym, setYm] = useState(() => { const d = local(now); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const { y, m } = ym;
  const first = Date.UTC(y, m, 1) - TZ_OFFSET;
  const startDow = localDow(first);
  const gridStart = first - startDow * DAY;
  const cells = Math.ceil((startDow + new Date(Date.UTC(y, m + 1, 0)).getUTCDate()) / 7) * 7;
  const today = dayStart(now);

  const byDay = new Map<number, Map<string, Ev>>();
  for (const { v, p } of allPosts(state)) {
    const at = p.publishedAt ?? p.scheduledAt;
    if (at < gridStart || at >= gridStart + cells * DAY) continue;
    const dk = dayStart(at);
    const day = byDay.get(dk) ?? new Map<string, Ev>();
    const g = day.get(v.id) ?? { v, at, posts: [] };
    g.posts.push(p);
    g.at = Math.min(g.at, at);
    day.set(v.id, g);
    byDay.set(dk, day);
  }
  const move = (d: number) => setYm(({ y, m }) => { m += d; return m < 0 ? { y: y - 1, m: 11 } : m > 11 ? { y: y + 1, m: 0 } : { y, m }; });
  const weeks = [0, 1, 2].map((w) => {
    const ws = today - localDow(now) * DAY + w * 7 * DAY;
    const n = new Set(allPosts(state).filter(({ p }) => { const a = p.publishedAt ?? p.scheduledAt; return a >= ws && a < ws + 7 * DAY && p.status !== 'failed' && p.status !== 'missed'; }).map(({ v }) => v.id)).size;
    return { ws, n };
  });

  return (
    <>
      <Card>
        <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
          <Button size="icon-sm" aria-label="Oldingi oy" onClick={() => move(-1)}><ChevronLeft size={16} /></Button>
          <h2 className="card-title min-w-[130px] text-center">{MONTHS_FULL[m]} {y}</h2>
          <Button size="icon-sm" aria-label="Keyingi oy" onClick={() => move(1)}><ChevronRight size={16} /></Button>
          <Button size="sm" variant="ghost" onClick={() => { const d = local(now); setYm({ y: d.getUTCFullYear(), m: d.getUTCMonth() }); }}>Bugun</Button>
          <Button size="sm" variant="primary" className="ml-auto" onClick={() => openModal({ type: 'schedule' })}><Plus size={14} />Rejalashtirish</Button>
        </div>
        <div className="grid grid-cols-1 overflow-hidden rounded-[10px] border-t border-l border-line md:grid-cols-7">
          {DOW_NAMES.map((d) => <div key={d} className="hidden border-r border-b border-line bg-surface-2 px-2.5 py-2 text-xs text-muted md:block">{d}</div>)}
          {Array.from({ length: cells }, (_, i) => {
            const ds = dayStart(gridStart + i * DAY + HOUR);
            const dd = local(ds);
            const out = dd.getUTCMonth() !== m;
            const evs = [...(byDay.get(ds)?.values() ?? [])].sort((a, b) => a.at - b.at);
            const isToday = ds === today;
            return (
              <div key={i} className={cn('group relative flex min-w-0 flex-col gap-1 border-r border-b border-line p-2 md:min-h-[118px]', out && 'bg-surface-2 max-md:hidden', !evs.length && !isToday && 'max-md:hidden')}>
                <span className={cn('grid size-6 place-items-center rounded-[7px] text-xs font-semibold', isToday && 'bg-accent text-accent-ink', out && 'text-muted')}>{dd.getUTCDate()}</span>
                <span className="text-[11px] text-muted md:hidden">{DOW_NAMES[localDow(ds)]}</span>
                {ds >= today && (
                  <Button size="icon-sm" variant="ghost" className="absolute top-1.5 right-1.5 md:opacity-0 md:group-hover:opacity-100" aria-label="Shu kunga rejalashtirish" onClick={() => openModal({ type: 'schedule', date: ds + 12 * HOUR })}><Plus size={14} /></Button>
                )}
                {evs.slice(0, 4).map((g) => {
                  const bad = g.posts.some((p) => p.status === 'failed' || p.status === 'missed');
                  const sch = g.posts.some((p) => p.status === 'scheduled');
                  const cls = bad ? 'border-critical' : sch ? (readiness(g.v) >= 1 ? 'border-accent/45' : 'border-warning/60') : 'border-line opacity-60';
                  return (
                    <button key={g.v.id} onClick={() => openVideo(g.v.id)} title={`${g.v.title} — ${g.posts.map((p) => pname(p.platform)).join(', ')}`} className={cn('flex w-full min-w-0 flex-col gap-0.5 rounded-md border bg-surface-2 px-1.5 py-[3px] text-left text-[11.5px] hover:border-line-2', cls)}>
                      <span className="flex items-center gap-1"><span className="mr-0.5 text-muted tnum">{fmtTime(g.at)}</span>{[...new Set(g.posts.map((p) => p.platform))].map((p) => <i key={p} className="size-[7px] rounded-[2px]" style={{ background: pcolor(p) }} />)}</span>
                      <span className="truncate">{g.v.title}</span>
                    </button>
                  );
                })}
                {evs.length > 4 && <span className="px-1.5 text-[11.5px] text-muted">+{evs.length - 4} yana</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3.5 text-xs text-ink-2">
          {[['border-accent/45', 'Tayyor, rejada'], ['border-warning/60', 'Rejada, tayyor emas'], ['border-line opacity-60', 'Joylangan'], ['border-critical', 'Xato / o‘tkazib yuborilgan']].map(([c, l]) => (
            <span key={l} className="inline-flex items-center gap-1.5"><i className={cn('h-2.5 w-3.5 rounded-[3px] border', c)} />{l}</span>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHead title="Haftalik reja" sub={`maqsad: ${state.goals.weeklyVideos} video`} />
          <div className="grid gap-3.5">
            {weeks.map((w, i) => (
              <div key={w.ws} className="grid gap-[7px]">
                <div className="flex justify-between text-[13px]"><span>{i === 0 ? 'Bu hafta' : i === 1 ? 'Keyingi hafta' : `${fmtDate(w.ws)} haftasi`}</span><span><b>{w.n}</b> <span className="text-muted">/ {state.goals.weeklyVideos}</span></span></div>
                <Meter value={w.n / state.goals.weeklyVideos} tone={w.n < state.goals.weeklyVideos ? 'warn' : 'accent'} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Eng yaxshi vaqtlar" sub="tarixiy natijalar bo‘yicha" />
          {PLATFORMS.map((p) => {
            const b = bestSlots(state, now, p.id, 3), d = bestDay(state, now, p.id);
            return (
              <div key={p.id} className="flex items-start gap-3 border-b border-line py-[11px] last:border-b-0">
                <div className="w-24 shrink-0"><Pf id={p.id} /></div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {b.map((x) => <Tag key={x.slot} title={`${x.n} ta post`}>{slotLabel(x.slot)} <b className={x.idx >= 1 ? 'text-good-text' : 'text-muted'}>{x.idx >= 1 ? '+' : ''}{Math.round((x.idx - 1) * 100)}%</b></Tag>)}
                  {!b.length && <span className="text-muted">Ma’lumot yetarli emas</span>}
                  {d && <span className="w-full text-xs text-muted">Eng kuchli kun: {DOW_NAMES[d.dow].toLowerCase()}</span>}
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}
