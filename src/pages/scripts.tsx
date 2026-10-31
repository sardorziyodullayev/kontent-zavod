// Ishlab chiqarish liniyasi: dnd-kit bilan sudrab o'tkaziladigan kanban.
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Link } from '@tanstack/react-router';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Eye, Factory, Plus, Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { DAY, STAGES, fmtNum, fmtTime, firstPublish, readiness, relDay, stageName, videoStats, type Stage, type Video } from '@/core';
import { PChips } from '@/components/bits';
import { useAppState } from '@/components/shell';
import { Button, buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/primitives';
import { useAct, useNow } from '@/lib/data';
import { openVideo } from '@/lib/ui';
import { cn } from '@/lib/utils';

/** Kartaning muddat holati: shoshilinch (2 kun ichida, tayyor emas), kechikish xavfi yoki joyida. */
function urgency(v: Video, now: number) {
  const next = v.posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  const r = readiness(v);
  return { next, r, level: next && r < 1 ? (next.scheduledAt - now < 2 * DAY ? 'crit' : 'warn') : 'ok' } as const;
}

function CardBody({ v, now }: { v: Video; now: number }) {
  const { next, r, level } = urgency(v, now);
  const pub = v.status === 'published' ? videoStats(v.posts, now) : null;
  const pct = Math.round(r * 100);
  return (
    <>
      <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <span className="truncate">{v.topic}</span>
        <span className="shrink-0">·</span>
        <span className="shrink-0">{v.format === 'long' ? 'Uzun' : 'Qisqa'}</span>
        {level === 'crit' && <AlertTriangle size={14} className="ml-auto shrink-0 text-critical-text" aria-label="Muddat yaqin, tayyor emas" />}
      </div>
      <div className="line-clamp-3 text-[14px] leading-snug font-semibold tracking-[-0.01em]">{v.title}</div>
      {!pub && (
        <div className="flex items-center gap-2.5">
          <div className="flex flex-1 gap-[3px]" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Tayyorlik">
            {Array.from({ length: 8 }, (_, i) => (
              <i key={i} className={cn('h-1.5 flex-1 rounded-full', i < Math.round(r * 8) ? (level === 'crit' ? 'bg-critical' : level === 'warn' ? 'bg-warning' : 'bg-accent') : 'bg-surface-3')} />
            ))}
          </div>
          <span className="w-8 text-right text-[11.5px] font-semibold tnum">{pct}%</span>
        </div>
      )}
      {pub && (
        <div className="flex gap-2 text-[12px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5"><Eye size={12} className="text-muted" />{fmtNum(pub.views)}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5"><UserPlus size={12} className="text-muted" />+{fmtNum(pub.subs)}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-line pt-2.5">
        {next ? (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap', level === 'crit' ? 'bg-critical/12 text-critical-text' : 'bg-surface-2 text-ink-2')}>
            <Clock size={12} />{relDay(next.scheduledAt, now)}, {fmtTime(next.scheduledAt)}
          </span>
        ) : <span className="text-[11.5px] text-muted">{pub ? 'Joylangan' : 'Sana belgilanmagan'}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          {next && <PChips ids={v.posts.filter((p) => p.status === 'scheduled').map((p) => p.platform)} />}
          <span className="grid size-6 place-items-center rounded-full bg-pill text-[10.5px] font-semibold text-pill-ink" title={`Mas’ul: ${v.owner}`}>{v.owner[0]}</span>
        </span>
      </div>
    </>
  );
}

const cardClass = 'grid gap-2.5 rounded-[18px] border border-[var(--card-border)] bg-surface p-3.5 shadow-card';

function KCard({ v, now }: { v: Video; now: number }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: v.id });
  return (
    <article ref={setNodeRef} {...listeners} {...attributes} onClick={() => openVideo(v.id, 'script')}
      className={cn(cardClass, 'cursor-grab outline-line-2 hover:outline', isDragging && 'opacity-35')}>
      <CardBody v={v} now={now} />
    </article>
  );
}

function Column({ id, n, name, count, children }: { id: Stage; n: number; name: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const done = id === 'published';
  return (
    <section aria-label={name} className="flex w-[min(84vw,286px)] shrink-0 snap-start flex-col">
      <header className="flex items-center gap-2.5 px-1.5 pb-3">
        <span className={cn('grid size-7 place-items-center rounded-[9px] text-[11.5px] font-bold tnum', done ? 'bg-accent text-accent-ink' : 'bg-surface text-ink-2 shadow-card')}>{n}</span>
        <h3 className="text-[14px] font-semibold">{name}</h3>
        <span className="ml-auto rounded-full bg-surface px-2.5 py-0.5 text-[12px] font-semibold tnum shadow-card">{count}</span>
      </header>
      <div ref={setNodeRef} className={cn('grid max-h-[calc(100vh-292px)] min-h-[150px] sm:min-h-[260px] content-start gap-2.5 overflow-y-auto rounded-[22px] bg-[var(--lane)] p-2', isOver && 'bg-accent-wash outline-2 -outline-offset-2 outline-accent outline-dashed')}>
        {children}
        {!count && <p className="grid min-h-[110px] place-items-center rounded-[18px] border border-dashed border-line-2 px-4 text-center text-[12.5px] text-muted">Kartani shu yerga sudrang</p>}
      </div>
    </section>
  );
}

function Summary({ by, dueSoon }: { by: Record<Stage, Video[]>; dueSoon: number }) {
  const total = STAGES.reduce((a, s) => a + by[s.id].length, 0) || 1;
  const inWork = by.script.length + by.production.length + by.editing.length;
  const cells = [
    { icon: Factory, label: 'Ishlab chiqarishda', value: inWork, sub: 'ssenariy, ovoz, montaj' },
    { icon: CalendarClock, label: 'Tayyor va rejada', value: by.ready.length + by.scheduled.length, sub: 'navbatda turibdi' },
    { icon: CheckCircle2, label: 'Joylangan', value: by.published.length, sub: 'barcha vaqt' },
    { icon: AlertTriangle, label: 'Shoshilinch', value: dueSoon, sub: '7 kun ichida, tayyor emas', warn: dueSoon > 0 },
  ];
  return (
    <Card className="p-0">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {cells.map((c, i) => (
          <div key={c.label} className={cn('flex items-center gap-3 border-line px-4 py-3.5 sm:p-5', i % 2 && 'border-l', i > 1 && 'max-lg:border-t lg:border-l')}>
            <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl max-sm:hidden', c.warn ? 'bg-critical/12 text-critical-text' : 'bg-surface-2 text-ink-2')}><c.icon size={18} /></span>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] text-muted">{c.label}</div>
              <div className="text-[24px] leading-tight font-semibold tracking-[-0.03em] tnum">{c.value}</div>
              <div className="hidden truncate text-[11.5px] text-muted sm:block">{c.sub}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line px-4 py-3.5 sm:px-5">
        <div className="flex h-2.5 gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
          {STAGES.map((s, i) => by[s.id].length > 0 && (
            <i key={s.id} className="h-full rounded-full" title={`${s.name}: ${by[s.id].length}`}
              style={{ flex: by[s.id].length / total, background: s.id === 'published' ? 'var(--accent)' : `color-mix(in oklab, var(--text) ${18 + i * 9}%, transparent)` }} />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
          {STAGES.map((s) => <span key={s.id}>{s.name} <b className="font-semibold text-ink tnum">{by[s.id].length}</b></span>)}
        </div>
      </div>
    </Card>
  );
}

export function ScriptsPage() {
  const { state } = useAppState();
  const now = useNow(60_000);
  const act = useAct();
  const [q, setQ] = useState('');
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const all = Object.fromEntries(STAGES.map((s) => [s.id, [] as Video[]])) as Record<Stage, Video[]>;
  for (const v of state.videos) all[v.status].push(v);
  all.published.sort((a, b) => firstPublish(b) - firstPublish(a));
  const dueSoon = state.videos.filter((v) => readiness(v) < 1 && v.posts.some((p) => p.status === 'scheduled' && p.scheduledAt - now < 7 * DAY)).length;

  const needle = q.trim().toLowerCase();
  const show = (v: Video) => (!needle || `${v.title} ${v.topic}`.toLowerCase().includes(needle)) && (!onlyUrgent || urgency(v, now).level !== 'ok');
  const by = Object.fromEntries(STAGES.map((s) => [s.id, all[s.id].filter(show)])) as Record<Stage, Video[]>;
  const dragged = dragId ? state.videos.find((v) => v.id === dragId) : undefined;

  const onDragEnd = (e: DragEndEvent) => {
    setDragId(null);
    const to = e.over?.id as Stage | undefined;
    const v = state.videos.find((x) => x.id === e.active.id);
    if (v && to && v.status !== to) act.mutate({ type: 'video.move', payload: { id: v.id, status: to } });
  };

  return (
    <>
      <Summary by={all} dueSoon={dueSoon} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input className="input rounded-full! pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sarlavha yoki mavzu bo‘yicha qidirish" aria-label="Qidirish" />
        </label>
        <Button variant={onlyUrgent ? 'dark' : 'default'} aria-pressed={onlyUrgent} onClick={() => setOnlyUrgent(!onlyUrgent)}>
          <AlertTriangle size={15} />Faqat muddati yaqinlar
        </Button>
        <form className="flex gap-1.5 max-sm:w-full sm:ml-auto" onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const title = (f.elements.namedItem('title') as HTMLInputElement).value.trim();
          if (title) act.mutate({ type: 'video.create', payload: { title, status: 'idea' } }, { onSuccess: () => f.reset() });
        }}>
          <input className="input rounded-full! sm:w-[260px]" name="title" placeholder="Yangi g‘oya yozing…" aria-label="Yangi g‘oya" required />
          <Button type="submit" variant="primary"><Plus size={16} /><span className="max-sm:hidden">G‘oya qo‘shish</span></Button>
        </form>
      </div>

      <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragCancel={() => setDragId(null)} onDragEnd={onDragEnd}>
        <div className="-mx-3 mt-4 flex snap-x items-start gap-3 overflow-x-auto px-3 pb-3 md:mx-0 md:px-0">
          {STAGES.map((c, i) => (
            <Column key={c.id} id={c.id} n={i + 1} name={c.name} count={by[c.id].length}>
              {(c.id === 'published' ? by[c.id].slice(0, 8) : by[c.id]).map((v) => <KCard key={v.id} v={v} now={now} />)}
              {c.id === 'published' && by.published.length > 8 && <Link to="/videolar" search={{ status: 'published' }} className={buttonClass('default', 'sm', 'w-full justify-center')}>Yana {by.published.length - 8} ta</Link>}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {dragged && <article className={cn(cardClass, 'w-[270px] rotate-[1.5deg] cursor-grabbing shadow-pop')}><CardBody v={dragged} now={now} /></article>}
        </DragOverlay>
      </DndContext>
      <p className="mt-2 text-[12.5px] text-muted">Kartani sudrab keyingi bosqichga o‘tkazing, bosib ssenariyni oching.</p>
      <p className="sr-only">Bosqichlar: {STAGES.map((s) => stageName(s.id)).join(', ')}</p>
    </>
  );
}
