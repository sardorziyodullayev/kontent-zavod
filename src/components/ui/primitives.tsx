import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...p }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('card', className)} {...p} />;
}

export function CardHead({ title, sub, right, className }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3.5 flex flex-wrap items-center gap-2.5', className)}>
      <h2 className="card-title">{title}</h2>
      {sub != null && <span className="text-[12.5px] text-muted">{sub}</span>}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

export type Tone = 'neutral' | 'good' | 'warning' | 'serious' | 'critical' | 'accent';
const dot: Record<Tone, string> = { neutral: '', good: 'bg-good', warning: 'bg-warning', serious: 'bg-serious', critical: 'bg-critical', accent: 'bg-accent' };

export function Tag({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex items-center gap-[5px] rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap', tone === 'accent' ? 'border-transparent bg-accent-wash text-accent-text' : 'border-line bg-surface-2 text-ink-2', className)}>
      {tone !== 'neutral' && <span className={cn('size-1.5 rounded-full', dot[tone])} />}
      {children}
    </span>
  );
}

export function Meter({ value, tone = 'accent', className }: { value: number; tone?: 'accent' | 'warn' | 'crit'; className?: string }) {
  const color = tone === 'crit' ? 'bg-critical' : tone === 'warn' ? 'bg-warning' : 'bg-accent';
  return (
    <div className={cn('h-2 overflow-hidden rounded bg-surface-3', className)} role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i className={cn('block h-full rounded', color)} style={{ width: `${Math.max(0, Math.min(100, value * 100)).toFixed(1)}%` }} />
    </div>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[10px] border border-line bg-surface-2 p-[3px]">
      {options.map((o) => (
        <button key={String(o.value)} aria-pressed={value === o.value} onClick={() => onChange(o.value)} className={cn('rounded-[7px] px-[11px] py-[5px] text-[13px] font-medium text-ink-2', value === o.value && 'bg-surface text-ink shadow-sm')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('grid gap-1.5', className)}>
      <span className="text-xs font-medium text-ink-2">{label}</span>
      {children}
    </label>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="py-5 text-center text-muted">{children}</p>;
