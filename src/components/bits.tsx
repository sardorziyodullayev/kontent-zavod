// Kichik domen komponentlari: platforma belgilari, holat teglari, muqova, delta, sparkline.
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { hashStr, pname, pshort, stageName, type PlatformId, type PostStatus, type Stage, type Video } from '@/core';
import { cn } from '@/lib/utils';
import { Card, Tag, type Tone } from './ui/primitives';

export const pcolor = (id: PlatformId) => `var(--s-${id})`;

export function Pf({ id, className }: { id: PlatformId; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-ink-2', className)}>
      <i className="size-[9px] shrink-0 rounded-[3px]" style={{ background: pcolor(id) }} />
      {pname(id)}
    </span>
  );
}

export function PChip({ id }: { id: PlatformId }) {
  return (
    <span className="inline-flex items-center gap-[5px] rounded-md border border-line bg-surface-2 py-0.5 pr-[7px] pl-1.5 text-[11.5px] font-semibold text-ink-2" title={pname(id)}>
      <i className="size-[7px] rounded-[2px]" style={{ background: pcolor(id) }} />
      {pshort(id)}
    </span>
  );
}
export function PChips({ ids }: { ids: PlatformId[] }) {
  return <span className="inline-flex flex-nowrap gap-1">{[...new Set(ids)].map((id) => <PChip key={id} id={id} />)}</span>;
}

const STAGE_TONE: Record<Stage, Tone> = { idea: 'neutral', script: 'neutral', production: 'neutral', editing: 'warning', ready: 'accent', scheduled: 'accent', published: 'good' };
export const StageTag = ({ s }: { s: Stage }) => <Tag tone={STAGE_TONE[s]}>{stageName(s)}</Tag>;

const POST: Record<PostStatus, [string, Tone]> = { scheduled: ['Rejada', 'accent'], published: ['Joylandi', 'good'], failed: ['Xato', 'critical'], missed: ['O‘tkazib yuborildi', 'critical'] };
export const PostTag = ({ s }: { s: PostStatus }) => <Tag tone={POST[s][1]}>{POST[s][0]}</Tag>;

export function Thumb({ v }: { v: Video }) {
  const d = v.format === 'long' ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}` : `0:${String(v.duration).padStart(2, '0')}`;
  return (
    <div className={cn('thumb relative shrink-0 overflow-hidden rounded-[7px]', v.format === 'long' ? 'h-[38px] w-16' : 'h-[52px] w-10')} style={{ '--h': hashStr(v.topic) % 360 } as React.CSSProperties}>
      <span className="absolute right-1 bottom-[3px] text-[9.5px] font-bold text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">{d}</span>
    </div>
  );
}

export function Delta({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev) return null;
  const d = (cur - prev) / prev;
  const good = invert ? d < 0 : d >= 0;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pill py-[3px] pr-2 pl-1.5 text-[11.5px] font-semibold text-pill-ink tnum">
      {d >= 0 ? <ArrowUpRight size={13} strokeWidth={2.5} className={good ? 'text-pill-up' : 'text-pill-down'} /> : <ArrowDownRight size={13} strokeWidth={2.5} className={good ? 'text-pill-up' : 'text-pill-down'} />}
      {Math.abs(d * 100).toFixed(1).replace('.0', '')}%
    </span>
  );
}

export function Sparkline({ values, w = 96, h = 28, color = 'var(--muted)', accent = 'var(--accent-text)' }: { values: number[]; w?: number; h?: number; color?: string; accent?: string }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values), min = Math.min(...values);
  const x = (i: number) => 2 + (i / Math.max(1, values.length - 1)) * (w - 6);
  const y = (v: number) => 3 + (h - 6) * (1 - (v - min) / (max - min || 1));
  const l = values.length - 1;
  return (
    <svg width={w} height={h} aria-hidden="true" className="shrink-0">
      <polyline points={values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" style={{ stroke: color }} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(l)} cy={y(values[l])} r={3} style={{ fill: accent }} />
    </svg>
  );
}

export function StatTile({ label, value, delta, foot, spark, title, icon: Icon, accent }: { label: string; value: ReactNode; delta?: ReactNode; foot?: ReactNode; spark?: ReactNode; title?: string; icon?: LucideIcon; accent?: boolean }) {
  return (
    <Card className={cn('grid gap-3 max-sm:p-4', accent && 'border-transparent bg-accent text-accent-ink')} title={title}>
      <div className="flex items-center gap-2.5">
        {Icon && <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', accent ? 'bg-accent-ink/10' : 'bg-surface-2 text-ink-2')}><Icon size={17} /></span>}
        <span className={cn('min-w-0 text-[13.5px] leading-tight font-medium max-sm:text-[12.5px]', accent ? 'text-accent-ink/75' : 'text-ink-2')}>{label}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="text-[34px] leading-none font-semibold tracking-[-0.035em] tnum max-[520px]:text-[26px]">{value}</div>
        <span className="max-sm:hidden">{spark}</span>
      </div>
      <div className="flex min-h-[22px] flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]">
        {delta}
        {foot && <span className={accent ? 'text-accent-ink/65' : 'text-muted'}>{foot}</span>}
      </div>
    </Card>
  );
}

export function MiniStat({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
      <div className="text-[11.5px] text-muted">{k}</div>
      <div className="text-lg font-semibold tracking-[-0.01em]">{v}</div>
    </div>
  );
}

export function BarRow({ label, value, max, display, color, title, labelWidth = 110 }: { label: ReactNode; value: number; max: number; display: ReactNode; color: string; title?: string; labelWidth?: number }) {
  return (
    <div className="grid items-center gap-3 text-[13px]" style={{ gridTemplateColumns: `${labelWidth}px minmax(0,1fr) 64px` }} title={title}>
      <span className="min-w-0 truncate">{label}</span>
      <div className="h-2.5">
        <div className="h-2.5 min-w-0.5 rounded-r" style={{ width: `${(value / (max || 1)) * 100}%`, background: color }} />
      </div>
      <span className="text-right font-medium tnum">{display}</span>
    </div>
  );
}
