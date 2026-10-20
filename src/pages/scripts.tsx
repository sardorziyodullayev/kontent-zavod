// Ishlab chiqarish liniyasi: dnd-kit bilan sudrab o'tkaziladigan kanban.
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Link } from '@tanstack/react-router';
import { Clock, Plus } from 'lucide-react';
import { DAY, STAGES, fmtNum, fmtTime, firstPublish, readiness, relDay, stageName, videoStats, type Stage, type Video } from '@/core';
import { PChips } from '@/components/bits';
import { useAppState } from '@/components/shell';
import { Button, buttonClass } from '@/components/ui/button';
import { Meter, Tag } from '@/components/ui/primitives';
import { useAct, useNow } from '@/lib/data';
import { openVideo } from '@/lib/ui';
import { cn } from '@/lib/utils';

function KCard({ v, now }: { v: Video; now: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: v.id });
  const r = readiness(v);
  const next = v.posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
  const pub = v.status === 'published' ? videoStats(v.posts, now) : null;
  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => openVideo(v.id, 'script')}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 30, position: 'relative' } : undefined}
      className={cn('mb-2 grid cursor-grab gap-2 rounded-[11px] border border-line bg-surface-2 px-3 py-[11px] hover:border-line-2', isDragging && 'cursor-grabbing shadow-pop')}
    >
      <div className="leading-snug font-medium">{v.title}</div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted"><span>{v.topic} · {v.format === 'long' ? 'uzun' : 'qisqa'}</span><span title="Mas’ul">{v.owner}</span></div>
      {v.status !== 'published' && (
        <div className="flex items-center gap-2">
          <Meter className="flex-1" value={r} tone={next && r < 1 && next.scheduledAt - now < 2 * DAY ? 'crit' : next && r < 1 ? 'warn' : 'accent'} />
          <span className="text-[11.5px] text-muted">{Math.round(r * 100)}%</span>
        </div>
      )}
      {next && <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted"><Clock size={13} /><span className="mr-auto">{relDay(next.scheduledAt, now)}, {fmtTime(next.scheduledAt)}</span><PChips ids={v.posts.filter((p) => p.status === 'scheduled').map((p) => p.platform)} /></div>}
      {pub && <div className="flex justify-between text-xs text-muted"><span>{fmtNum(pub.views)} ko‘rish</span><span>+{fmtNum(pub.subs)} obunachi</span></div>}
    </article>
  );
}

function Column({ id, name, children, count }: { id: Stage; name: string; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={name} className={cn('min-h-[200px] rounded-2xl border border-line bg-surface p-3', isOver && 'outline-2 -outline-offset-4 outline-accent outline-dashed')}>
      <div className="flex items-center gap-2 px-1 pt-0.5 pb-3"><h3 className="font-display text-[12.5px] font-semibold">{name}</h3><span className="text-xs text-muted">{count}</span></div>
      {children}
    </section>
  );
}

export function ScriptsPage() {
  const { state } = useAppState();
  const now = useNow(60_000);
  const act = useAct();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const by = Object.fromEntries(STAGES.map((s) => [s.id, [] as Video[]])) as Record<Stage, Video[]>;
  for (const v of state.videos) by[v.status].push(v);
  by.published.sort((a, b) => firstPublish(b) - firstPublish(a));
  const inWork = by.script.length + by.production.length + by.editing.length;
  const dueSoon = state.videos.filter((v) => readiness(v) < 1 && v.posts.some((p) => p.status === 'scheduled' && p.scheduledAt - now < 7 * DAY)).length;

  const onDragEnd = (e: DragEndEvent) => {
    const to = e.over?.id as Stage | undefined;
    const v = state.videos.find((x) => x.id === e.active.id);
    if (v && to && v.status !== to) act.mutate({ type: 'video.move', payload: { id: v.id, status: to } });
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tag>{inWork} ta video ishlab chiqarishda</Tag>
        {dueSoon > 0 && <Tag tone="warning">{dueSoon} tasi 7 kun ichida chiqishi kerak, hali tayyor emas</Tag>}
        <span className="ml-auto text-[12.5px] text-muted">Kartani sudrab keyingi bosqichga o‘tkazing</span>
      </div>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid auto-cols-[minmax(250px,1fr)] grid-flow-col items-start gap-3 overflow-x-auto pb-3">
          {STAGES.map((c) => (
            <Column key={c.id} id={c.id} name={c.name} count={by[c.id].length}>
              {c.id === 'idea' && (
                <form className="mb-2.5 flex gap-1.5" onSubmit={(e) => {
                  e.preventDefault();
                  const f = e.currentTarget;
                  const title = (f.elements.namedItem('title') as HTMLInputElement).value.trim();
                  if (title) act.mutate({ type: 'video.create', payload: { title, status: 'idea' } }, { onSuccess: () => f.reset() });
                }}>
                  <input className="input !h-[34px]" name="title" placeholder="Yangi g‘oya…" aria-label="Yangi g‘oya" required />
                  <Button type="submit" size="icon-sm" variant="primary" aria-label="Qo‘shish" className="!size-[34px]"><Plus size={15} /></Button>
                </form>
              )}
              {(c.id === 'published' ? by[c.id].slice(0, 6) : by[c.id]).map((v) => <KCard key={v.id} v={v} now={now} />)}
              {c.id === 'published' && by.published.length > 6 && <Link to="/videolar" search={{ status: 'published' }} className={buttonClass('ghost', 'sm', 'w-full justify-center')}>Yana {by.published.length - 6} ta</Link>}
            </Column>
          ))}
        </div>
      </DndContext>
      <p className="sr-only">Bosqichlar: {STAGES.map((s) => stageName(s.id)).join(', ')}</p>
    </>
  );
}
