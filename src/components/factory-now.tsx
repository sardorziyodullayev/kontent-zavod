// "Zavod hozir": AI liniyasi (ssenariy → ovoz → montaj → navbat → joylash), bugungi jadval va tizim tayyorligi.
import { Link } from '@tanstack/react-router';
import { Check, Clapperboard, FileText, Mic, Radio, Send } from 'lucide-react';
import { DAY, allPosts, dayStart, fmtTime, nextQueue, pname, relDay, type State, type Video } from '@/core';
import type { AppData } from '@/lib/data';
import { useNow } from '@/lib/data';
import { openVideo } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { PChips } from './bits';
import { BRAND } from './brand';
import { Card } from './ui/primitives';

type Mode = { label: string; sub: string; tone: 'live' | 'sim' | 'demo' };
function modeOf(data: AppData): Mode {
  if (data.mode === 'demo') return { label: 'Demo rejim', sub: 'ma’lumot brauzerda', tone: 'demo' };
  if (data.state.workspace.autoPublish) return { label: 'Simulyatsiya', sub: 'joylash sinov rejimida', tone: 'sim' };
  return { label: 'Avtopilot yoqilgan', sub: 'jadval bo‘yicha o‘zi joylaydi', tone: 'live' };
}

export function AutopilotBadge({ data }: { data: AppData }) {
  const m = modeOf(data);
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface p-2.5">
      <span className={cn('pm-live size-2.5 shrink-0 rounded-[3px]', m.tone === 'live' ? 'bg-accent' : m.tone === 'sim' ? 'bg-warning' : 'bg-muted')} />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[12.5px] font-semibold">{m.label}</div>
        <div className="truncate text-[11px] text-muted">{BRAND.handle} · {m.sub}</div>
      </div>
    </div>
  );
}

const STEPS = [
  { key: 'script', name: 'Ssenariy', short: 'Matn', sub: 'AI yozadi', icon: FileText },
  { key: 'voice', name: 'Ovoz', short: 'Ovoz', sub: 'AI ovoz beradi', icon: Mic },
  { key: 'edit', name: 'Montaj', short: 'Montaj', sub: 'motion studiya', icon: Clapperboard },
  { key: 'queue', name: 'Navbatda', short: 'Navbat', sub: 'jadval bo‘yicha', icon: Radio },
  { key: 'live', name: 'Joylandi', short: 'Chiqdi', sub: 'tarmoqlarda', icon: Send },
] as const;

/** Video liniyaning qaysi bosqichida turibdi (0..4). */
function stepOf(v: Video) {
  if (v.status === 'published') return 4;
  if (!v.checklist.script) return 0;
  if (!v.checklist.voice) return 1;
  if (!v.checklist.footage || !v.checklist.edit) return 2;
  return 3;
}

export function FactoryNow({ data }: { data: AppData }) {
  const now = useNow(30_000);
  const { state } = data;
  const m = modeOf(data);
  const counts = [0, 0, 0, 0, 0];
  for (const v of state.videos) counts[stepOf(v)]++;
  const next = nextQueue(state, now)[0];
  const nextV = next ? state.videos.find((v) => v.id === next.videoId) : undefined;
  const active = nextV ? stepOf(nextV) : -1;
  const t0 = dayStart(now);
  const today = allPosts(state).filter(({ p }) => (p.status === 'scheduled' && p.scheduledAt >= t0 && p.scheduledAt < t0 + DAY) || (p.status === 'published' && p.publishedAt! >= t0)).sort((a, b) => (a.p.publishedAt ?? a.p.scheduledAt) - (b.p.publishedAt ?? b.p.scheduledAt));
  return (
    <Card className="relative overflow-hidden p-0">
      <div className="relative grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12px] font-semibold', m.tone === 'live' ? 'bg-accent text-accent-ink' : 'bg-surface-3 text-ink-2')}>
              <span className={cn('pm-live size-2 rounded-[2px]', m.tone === 'live' ? 'bg-accent-ink' : m.tone === 'sim' ? 'bg-warning' : 'bg-muted')} />{m.label}
            </span>
            <span className="text-[12.5px] text-muted">{m.sub}</span>
          </div>
          <h2 className="mt-3 max-w-[22ch] font-display text-[26px] leading-[1.12] font-semibold tracking-[-0.025em] sm:text-[32px]">
            Video tayyorlash va joylashni <span className="text-accent-text">AI o‘zi</span> qiladi
          </h2>
          <p className="mt-2 max-w-[56ch] text-[13.5px] text-ink-2">Har kuni belgilangan tartibda: ssenariy yoziladi, ovoz beriladi, montaj qilinadi va tarmoqlarga o‘z vaqtida chiqadi.</p>

          <ol className="mt-5 grid grid-cols-5 gap-1.5 sm:gap-2" aria-label="Ishlab chiqarish liniyasi">
            {STEPS.map((s, i) => (
              <li key={s.key} className={cn('relative min-w-0 rounded-[12px] border p-2 sm:p-3', i === active ? 'border-accent bg-accent-wash' : 'border-line bg-surface-2')}>
                <div className="flex items-center justify-between">
                  <s.icon size={17} className={i === active ? 'text-accent-text' : 'text-muted'} />
                  {i === active && <span className="hidden gap-[3px] sm:flex" title="Hozir shu bosqichda">{[0, 1, 2].map((d) => <i key={d} className="pm-dot size-[5px] rounded-[1px] bg-accent" style={{ animationDelay: `${d * 160}ms` }} />)}</span>}
                </div>
                <div className="mt-2 text-[19px] leading-none font-semibold tracking-[-0.02em] tnum sm:mt-2.5 sm:text-[22px]">{counts[i]}</div>
                <div className="mt-1 text-[10.5px] font-semibold sm:text-[12.5px]"><span className="sm:hidden">{s.short}</span><span className="hidden sm:inline">{s.name}</span></div>
                <div className="hidden truncate text-[11px] text-muted sm:block">{s.sub}</div>
              </li>
            ))}
          </ol>
          {nextV && next && (
            <button onClick={() => openVideo(nextV.id)} className="mt-3 flex w-full items-center gap-3 rounded-[10px] px-1 py-1.5 text-left text-[13px] hover:bg-surface-2">
              <span className="hidden shrink-0 text-muted sm:inline">Hozir ishlanmoqda:</span>
              <b className="min-w-0 truncate font-medium">{nextV.title}</b>
              <span className="ml-auto shrink-0 text-muted">{relDay(next.scheduledAt, now)}, {fmtTime(next.scheduledAt)}</span>
            </button>
          )}
        </div>

        <div className="grid content-start gap-4">
          <div>
            <div className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Bugun</div>
            {today.length ? today.slice(0, 4).map(({ v, p }) => (
              <button key={p.id} onClick={() => openVideo(v.id)} className="flex w-full items-center gap-2.5 border-b border-line py-2 text-left text-[13px] last:border-b-0 hover:bg-surface-2">
                <b className="w-[42px] shrink-0 tnum">{fmtTime(p.publishedAt ?? p.scheduledAt)}</b>
                <PChips ids={[p.platform]} />
                <span className="min-w-0 flex-1 truncate">{v.title}</span>
                {p.status === 'published' && <Check size={15} className="shrink-0 text-good-text" aria-label="Joylandi" />}
              </button>
            )) : <p className="text-[13px] text-muted">{next ? `Bugun joylash yo‘q. Keyingisi: ${relDay(next.scheduledAt, now).toLowerCase()}, ${fmtTime(next.scheduledAt)} · ${pname(next.platform)}` : 'Reja bo‘sh — video rejalashtiring.'}</p>}
          </div>
          <Readiness state={state} live={m.tone === 'live'} />
        </div>
      </div>
    </Card>
  );
}

function Readiness({ state, live }: { state: State; live: boolean }) {
  const pl = (id: string) => state.platforms.find((p) => p.id === id)?.connected ?? false;
  const items = [
    { ok: pl('telegram'), label: 'Telegram ulangan', to: '/platformalar' },
    { ok: pl('youtube'), label: 'YouTube ulangan', to: '/platformalar' },
    { ok: state.videos.length >= 7, label: `Kontent rejasi (${state.videos.length} video)`, to: '/reja' },
    { ok: live, label: 'Haqiqiy joylash yoqilgan', to: '/konveyer' },
    { ok: allPosts(state).some(({ p }) => p.status === 'published'), label: 'Birinchi video joylandi', to: '/videolar' },
  ] as const;
  const done = items.filter((x) => x.ok).length;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between"><span className="text-[11px] font-semibold tracking-[0.1em] text-muted uppercase">Tizim</span><span className="text-[12px] text-muted"><b className="text-ink">{done}</b>/{items.length} tayyor</span></div>
      <ul className="grid gap-1.5">
        {items.map((x) => (
          <li key={x.label}>
            <Link to={x.to} className="flex items-center gap-2.5 rounded-lg py-0.5 text-[13px] hover:text-ink">
              <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-[5px]', x.ok ? 'bg-accent text-accent-ink' : 'border border-line-2')}>{x.ok && <Check size={12} strokeWidth={3} />}</span>
              <span className={x.ok ? 'text-ink-2' : 'text-ink'}>{x.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
