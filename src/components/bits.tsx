// Kichik domen komponentlari: platforma belgilari, holat teglari, muqova, delta, sparkline.
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
    <span className={cn('inline-flex items-center gap-[3px] text-[12.5px] font-semibold', good ? 'text-good-text' : 'text-critical-text')}>
      {d >= 0 ? '▲' : '▼'} {Math.abs(d * 100).toFixed(1).replace('.0', '')}%
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

export function StatTile({ label, value, delta, foot, spark, title }: { label: string; value: ReactNode; delta?: ReactNode; foot?: ReactNode; spark?: ReactNode; title?: string }) {
  return (
    <Card className="grid gap-1" title={title}>
      <div className="text-[12.5px] font-medium text-ink-2">{label}</div>
      <div className="text-[30px] leading-[1.1] font-semibold tracking-[-0.025em] max-[520px]:text-[26px]">{value}</div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[12.5px]">
          {delta}
          {foot && <span className="text-muted"> {foot}</span>}
        </span>
        {spark}
      </div>
    </Card>
  );
}

export function MiniStat({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="rounded-[10px] bg-surface-2 px-3 py-2.5">
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
