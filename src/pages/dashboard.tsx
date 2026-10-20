import { Link } from '@tanstack/react-router';
import { ArrowRight, Calendar, Film, Play, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  CHECKLIST, DAY, MONTHS_FULL, PLATFORMS, PLATFORM_IDS, TZ_OFFSET, allPosts, bestSlots, countdown, dailySeries, dayStart, fmtDate, fmtFull, fmtNum, fmtTime,
  followersAt, forecastPost, kpis, local, localDow, localHour, nextQueue, pname, postStats, readiness, relDay, rowTotal, slotLabel, slotOf, type State,
} from '@/core';
import { AlertsCard } from '@/components/alerts';
import { FactoryNow } from '@/components/factory-now';
import { BarRow, Delta, PChips, Pf, Sparkline, StatTile, pcolor } from '@/components/bits';
import { MultiLine } from '@/components/line-chart';
import { useAppState } from '@/components/shell';
import { Button, buttonClass } from '@/components/ui/button';
import { Card, CardHead, Empty, Meter, Segmented, Tag } from '@/components/ui/primitives';
import { useAct, useNow } from '@/lib/data';
import { openModal, openVideo, pfList, setUI, useUI, type Period } from '@/lib/ui';
import { cn } from '@/lib/utils';

export function PeriodFilters({ count }: { count?: string }) {
  const period = useUI((s) => s.period);
  const pf = useUI((s) => s.pf);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented label="Davr" value={period} onChange={(v) => setUI({ period: v as Period })} options={[7, 30, 90].map((d) => ({ value: d, label: `${d} kun` }))} />
      <select className="input !h-[34px] !w-auto" aria-label="Platforma" value={pf} onChange={(e) => setUI({ pf: e.target.value as typeof pf })}>
        <option value="all">Barcha platformalar</option>
        {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {count && <span className="text-[12.5px] text-muted">{count}</span>}
    </div>
  );
}

function Countdown({ at }: { at: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return <div className="text-4xl leading-none font-semibold tracking-[-0.03em] tnum">{countdown(at - now)}</div>;
}

function NextVideo({ state, now }: { state: State; now: number }) {
  const act = useAct();
  const q = nextQueue(state, now)[0];
  if (!q) return <Card><div className="text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">Keyingi video</div><Empty>Hech narsa rejalashtirilmagan. <Button size="sm" onClick={() => openModal({ type: 'schedule' })}>Rejalashtirish</Button></Empty></Card>;
  const v = state.videos.find((x) => x.id === q.videoId)!;
  const posts = v.posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt);
  const at = posts[0].scheduledAt;
  const r = readiness(v);
  const per = posts.map((p) => ({ p, f: forecastPost(state, now, v, p), best: bestSlots(state, now, p.platform, 1)[0] }));
  const sum = (k: 'mid' | 'lo' | 'hi' | 'subs' | 'subsLo' | 'subsHi') => per.reduce((a, x) => a + (x.f?.[k] ?? 0), 0);
  const conf = per.some((x) => x.f?.confidence === 'past') ? 'Past' : per.some((x) => x.f?.confidence === 'o‘rta') ? 'O‘rta' : 'Yuqori';
  const n = Math.min(...per.map((x) => x.f?.n ?? 0));
  const missing = CHECKLIST.filter((c) => !v.checklist[c.id]);
  return (
    <Card aria-label="Keyingi video">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">Keyingi video</div>
          <h2 className="mt-2 mb-2.5 max-w-[30ch] font-display text-xl leading-tight font-semibold tracking-[-0.02em] sm:text-2xl">{v.title}</h2>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-ink-2"><PChips ids={posts.map((p) => p.platform)} /><span>{v.topic}</span><span>{v.format === 'long' ? 'Uzun video' : 'Qisqa video'}</span><span>Mas’ul: {v.owner}</span></div>
        </div>
        <div className="sm:text-right">
          <div className="mb-1.5 text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">Joylashgacha</div>
          <Countdown at={at} />
          <div className="mt-1.5 text-[13px] text-ink-2">{relDay(at, now)}, {fmtTime(at)} · Toshkent</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2.5 flex items-baseline justify-between gap-3"><span><b className="text-[15px]">{Math.round(r * 100)}%</b> <span className="text-ink-2">tayyor</span></span><span className="text-right text-[12.5px] text-muted">{r >= 1 ? 'Hammasi tayyor — vaqtida avtomatik chiqadi' : `Yetishmaydi: ${missing.length} ta bosqich`}</span></div>
        <div className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-8">
          {CHECKLIST.map((c) => {
            const on = v.checklist[c.id];
            return (
              <button key={c.id} title={c.name} aria-pressed={on} onClick={() => act.mutate({ type: 'video.check', payload: { id: v.id, key: c.id, value: !on } })} className="group grid min-w-0 gap-[7px] text-left">
                <span className={cn('h-2 rounded group-hover:outline group-hover:outline-offset-1 group-hover:outline-line-2', on ? 'bg-accent' : 'bg-surface-3')} />
                <span className={cn('line-clamp-2 text-[11.5px] leading-tight', on ? 'text-ink-2' : 'text-muted')}>{c.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {per.some((x) => x.f) && <>
        <div className="mt-[18px] grid overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-3" style={{ gap: 1 }}>
          {[
            ['Kutilayotgan ko‘rishlar', fmtNum(sum('mid')), `${fmtNum(sum('lo'))} – ${fmtNum(sum('hi'))}`],
            ['Yangi obunachilar', `+${fmtNum(sum('subs'))}`, `${fmtNum(sum('subsLo'))} – ${fmtNum(sum('subsHi'))}`],
            ['Prognoz ishonchi', conf, `${n} ta o‘xshash post asosida`],
          ].map(([k, val, rr]) => (
            <div key={k} className="bg-surface-2 px-3.5 py-3"><div className="text-[11.5px] text-muted">{k}</div><div className="mt-0.5 text-lg font-semibold tracking-[-0.01em]">{val}</div><div className="text-xs text-ink-2">{rr}</div></div>
          ))}
        </div>
        <div className="-mx-5 mt-3.5 overflow-x-auto px-5">
          <table className="table">
            <thead><tr><th>Platforma</th><th>Vaqt</th><th className="r">Prognoz (ko‘rish)</th><th className="r">+Obunachi</th><th>Shu platforma uchun eng yaxshi vaqt</th></tr></thead>
            <tbody>
              {per.map(({ p, f, best }) => (
                <tr key={p.id}>
                  <td><Pf id={p.platform} /></td><td>{fmtTime(p.scheduledAt)}</td>
                  <td className="r">{f ? `${fmtNum(f.lo)}–${fmtNum(f.hi)}` : '—'}</td><td className="r">{f ? `+${fmtNum(f.subs)}` : '—'}</td>
                  <td>{best ? <Tag tone={slotOf(localHour(p.scheduledAt)) === best.slot ? 'good' : 'neutral'}>{slotLabel(best.slot)}{slotOf(localHour(p.scheduledAt)) === best.slot && ' ✓'}</Tag> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => openVideo(v.id)}><Film size={15} />Videoni ochish</Button>
        <Button size="sm" onClick={async () => {
          if (!confirm(`“${v.title}” barcha rejadagi platformalarga hozir joylansinmi?`)) return;
          for (const p of posts) await act.mutateAsync({ type: 'post.publishNow', payload: { postId: p.id } });
        }}><Play size={15} />Hozir joylash</Button>
        <Link to="/reja" className={buttonClass('ghost', 'sm')}><Calendar size={15} />Kalendar</Link>
      </div>
    </Card>
  );
}

function Kpis({ state, now }: { state: State; now: number }) {
  const period = useUI((s) => s.period);
  const pf = useUI((s) => s.pf);
  const pfs = pfList(pf, PLATFORM_IDS);
  const d = useMemo(() => {
    const k = kpis(state, now, period, pfs);
    const views = dailySeries(state, now - period * DAY, now, 'views', pfs).map(rowTotal);
    const subs = dailySeries(state, now - period * DAY, now, 'subs', pfs).map(rowTotal);
    const posts: number[] = [];
    for (let x = dayStart(now - (period - 1) * DAY); x <= now; x += DAY) posts.push(allPosts(state).filter(({ p }) => p.status === 'published' && pfs.includes(p.platform) && p.publishedAt! >= x && p.publishedAt! < x + DAY).length);
    return { k, views, subs, posts };
  }, [state, now, period, pf]); // eslint-disable-line react-hooks/exhaustive-deps
  const foot = `oldingi ${period} kunga`;
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatTile label="Ko‘rishlar" title={fmtFull(d.k.cur.views)} value={fmtNum(d.k.cur.views)} delta={<Delta cur={d.k.cur.views} prev={d.k.prev.views} />} foot={foot} spark={<Sparkline values={d.views} />} />
      <StatTile label="Yangi obunachilar" title={fmtFull(d.k.cur.subs)} value={`+${fmtNum(d.k.cur.subs)}`} delta={<Delta cur={d.k.cur.subs} prev={d.k.prev.subs} />} foot={foot} spark={<Sparkline values={d.subs} />} />
      <StatTile label="Joylashlar" value={fmtFull(d.k.cur.posts)} delta={<Delta cur={d.k.cur.posts} prev={d.k.prev.posts} />} foot={foot} spark={<Sparkline values={d.posts} />} />
      <StatTile label="O‘rtacha ER" value={`${(d.k.cur.er * 100).toFixed(1)}%`} delta={<Delta cur={d.k.cur.er} prev={d.k.prev.er} />} foot={foot} spark={<span className="max-w-[110px] text-right text-[11px] text-muted">layk+izoh+ulashish+saqlash / ko‘rish</span>} />
    </div>
  );
}

export function ViewsChart({ state, now }: { state: State; now: number }) {
  const period = useUI((s) => s.period);
  const pf = useUI((s) => s.pf);
  const c = useMemo(() => {
    const pfs = pfList(pf, PLATFORM_IDS);
    const days = dailySeries(state, now - (period - 1) * DAY, now, 'views', pfs);
    return {
      labels: days.map((x) => fmtDate(x.day)),
      tips: days.map((x) => fmtDate(x.day, { weekday: true }) + (x.day === dayStart(now) ? ' · bugun, davom etmoqda' : '')),
      series: pfs.map((id) => ({ id, name: pname(id), color: pcolor(id), values: days.map((x) => x.values[id]) })),
    };
  }, [state, now, period, pf]);
  return (
    <Card>
      <CardHead title="Kunlik ko‘rishlar" sub="platformalar bo‘yicha, Toshkent vaqti" />
      {c.series.some((x) => x.values.some((n) => n > 0))
        ? <MultiLine labels={c.labels} tipLabels={c.tips} series={c.series} height={270} total aria="Kunlik ko‘rishlar" />
        : <EmptyState title="Statistika shu yerda chiqadi" text="Birinchi videolar joylangach, ko‘rishlar har 30 daqiqada platformalardan avtomatik olinadi." />}
    </Card>
  );
}

function PlatformShare({ state, now }: { state: State; now: number }) {
  const period = useUI((s) => s.period);
  const rows = useMemo(() => PLATFORMS.map((p) => ({
    ...p,
    views: dailySeries(state, now - period * DAY, now, 'views', [p.id]).reduce((a, r) => a + r.values[p.id], 0),
    f: followersAt(state, p.id, now),
    g: followersAt(state, p.id, now) - followersAt(state, p.id, now - period * DAY),
  })), [state, now, period]);
  const max = Math.max(...rows.map((r) => r.views), 1);
  return (
    <Card>
      <CardHead title="Platformalar" sub={max > 1 ? `${period} kunlik ko‘rishlar` : 'obunachilar'} />
      {max > 1 && <div className="grid gap-3">{[...rows].sort((a, b) => b.views - a.views).map((r) => <BarRow key={r.id} label={<Pf id={r.id} />} value={r.views} max={max} display={fmtNum(r.views)} color={pcolor(r.id)} title={`${r.name}: ${fmtFull(r.views)} ko‘rish`} />)}</div>}
      <div className={cn('-mx-5 overflow-x-auto px-5', max > 1 && 'mt-4')}>
        <table className="table">
          <thead><tr><th>Obunachilar</th><th className="r">Jami</th><th className="r">+{period} kun</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.id}><td><Pf id={r.id} /></td><td className="r">{fmtFull(r.f)}</td><td className="r text-good-text">+{fmtNum(r.g)}</td></tr>)}</tbody>
        </table>
      </div>
    </Card>
  );
}

function Upcoming({ state, now }: { state: State; now: number }) {
  const groups = new Map<string, { v: State['videos'][number]; at: number; pfs: State['videos'][number]['posts'][number]['platform'][] }>();
  for (const { v, p } of allPosts(state)) {
    if (p.status !== 'scheduled' || p.scheduledAt > now + 7 * DAY) continue;
    const k = v.id + dayStart(p.scheduledAt);
    const g = groups.get(k) ?? { v, at: p.scheduledAt, pfs: [] };
    g.pfs.push(p.platform);
    g.at = Math.min(g.at, p.scheduledAt);
    groups.set(k, g);
  }
  const list = [...groups.values()].sort((a, b) => a.at - b.at);
  return (
    <Card>
      <CardHead title="Yaqin 7 kun" sub={`${list.length} ta video`} right={<Button size="sm" onClick={() => openModal({ type: 'schedule' })}><Plus size={14} />Rejalashtirish</Button>} />
      {list.map((g) => {
        const r = readiness(g.v);
        return (
          <button key={g.v.id + g.at} onClick={() => openVideo(g.v.id)} className="flex w-full items-center gap-3 rounded-lg border-b border-line py-[11px] text-left last:border-b-0 hover:bg-surface-2">
            <div className="w-[74px] shrink-0"><b className="block text-[13px]">{fmtTime(g.at)}</b><span className="text-xs text-muted">{relDay(g.at, now)}</span></div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{g.v.title}</div>
              <div className="mt-[5px] flex items-center gap-2.5"><PChips ids={g.pfs} /><Meter className="max-w-[120px] flex-1" value={r} tone={r < 1 && g.at - now < 2 * DAY ? 'crit' : r < 1 ? 'warn' : 'accent'} /><span className="text-xs text-muted">{Math.round(r * 100)}%</span></div>
            </div>
          </button>
        );
      })}
      {!list.length && <Empty>Bu hafta uchun reja yo‘q</Empty>}
    </Card>
  );
}

function Recent({ state, now }: { state: State; now: number }) {
  const list = allPosts(state).filter(({ p }) => p.status === 'published').sort((a, b) => b.p.publishedAt! - a.p.publishedAt!).slice(0, 8);
  return (
    <Card>
      <CardHead title="Oxirgi joylanganlar" right={<Link to="/videolar" className={buttonClass('ghost', 'sm')}>Barchasi <ArrowRight size={14} /></Link>} />
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="table">
          <thead><tr><th>Qachon</th><th>Platforma</th><th>Video</th><th className="r">Ko‘rish</th><th className="r">+Obun.</th></tr></thead>
          <tbody>
            {!list.length && <tr><td colSpan={5}><EmptyState title="Hali joylangan video yo‘q" text="Rejadagi videolar vaqti kelganda shu ro‘yxatga tushadi." /></td></tr>}
            {list.map(({ v, p }) => { const s = postStats(p, now); return (
              <tr key={p.id} className="click" onClick={() => openVideo(v.id)}>
                <td className="whitespace-nowrap">{relDay(p.publishedAt!, now)}, {fmtTime(p.publishedAt!)}</td><td><PChips ids={[p.platform]} /></td>
                <td><span className="block max-w-[200px] truncate font-medium">{v.title}</span></td><td className="r">{fmtNum(s.views)}</td><td className="r">+{fmtNum(s.subs)}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid place-items-center gap-2 px-4 py-10 text-center">
      <span className="grid grid-cols-3 gap-[3px]" aria-hidden="true">{[1, 0, 1, 0, 1, 0, 1, 0, 1].map((on, i) => <i key={i} className={cn('size-[7px] rounded-[2px]', on ? 'bg-accent' : 'bg-surface-3')} />)}</span>
      <div className="mt-1 font-semibold">{title}</div>
      <p className="max-w-[44ch] text-[13px] text-muted">{text}</p>
    </div>
  );
}

function Goals({ state, now }: { state: State; now: number }) {
  const d = local(now);
  const mStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - TZ_OFFSET;
  const mEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - TZ_OFFSET;
  const frac = (now - mStart) / (mEnd - mStart);
  const sum = (m: 'views' | 'subs') => dailySeries(state, mStart, now, m).reduce((a, r) => a + rowTotal(r), 0);
  const subs = sum('subs'), views = sum('views');
  const wStart = dayStart(now) - localDow(now) * DAY;
  const week = new Set(allPosts(state).filter(({ p }) => (p.status === 'published' && p.publishedAt! >= wStart) || (p.status === 'scheduled' && p.scheduledAt < wStart + 7 * DAY)).map(({ v }) => v.id)).size;
  const G = ({ label, cur, goal, pace }: { label: string; cur: number; goal: number; pace?: number }) => (
    <div className="grid gap-[7px]">
      <div className="flex justify-between text-[13px]"><span>{label}</span><span><b className="font-semibold">{fmtNum(cur)}</b> <span className="text-muted">/ {fmtNum(goal)}</span></span></div>
      <Meter value={cur / goal} tone={pace != null && pace < goal * 0.9 ? 'warn' : 'accent'} />
      {pace != null && <div className="text-xs text-muted">Shu sur’atda oy oxirida: <b className="text-ink-2">{fmtNum(pace)}</b> {pace >= goal ? '— maqsadga yetiladi' : `— ${fmtNum(goal - pace)} yetmaydi`}</div>}
    </div>
  );
  return (
    <Card>
      <CardHead title="Maqsadlar" sub={MONTHS_FULL[d.getUTCMonth()]} right={<Link to="/sozlamalar" className={buttonClass('ghost', 'sm')}>O‘zgartirish</Link>} />
      <div className="grid gap-[18px]">
        <G label="Yangi obunachilar (oy)" cur={subs} goal={state.goals.monthlySubs} pace={subs / frac} />
        <G label="Ko‘rishlar (oy)" cur={views} goal={state.goals.monthlyViews} pace={views / frac} />
        <G label="Videolar (bu hafta, reja bilan)" cur={week} goal={state.goals.weeklyVideos} />
      </div>
    </Card>
  );
}

export function Activity({ state, now, n = 8 }: { state: State; now: number; n?: number }) {
  return (
    <Card>
      <CardHead title="Faoliyat jurnali" />
      {state.activity.slice(0, n).map((a, i) => (
        <div key={i} className="grid grid-cols-[54px_minmax(0,1fr)] gap-2.5 border-b border-line py-2 text-[13px] last:border-b-0">
          <time className="text-xs text-muted tnum">{Math.abs(now - a.t) < DAY ? fmtTime(a.t) : fmtDate(a.t)}</time><span>{a.text}</span>
        </div>
      ))}
    </Card>
  );
}

export function DashboardPage() {
  const data = useAppState();
  const { state } = data;
  const now = useNow(60_000);
  return (
    <>
      <FactoryNow data={data} />
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <NextVideo state={state} now={now} />
        <AlertsCard state={state} now={now} limit={4} />
      </div>
      <div className="mt-4"><PeriodFilters /></div>
      <Kpis state={state} now={now} />
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"><ViewsChart state={state} now={now} /><PlatformShare state={state} now={now} /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><Upcoming state={state} now={now} /><Recent state={state} now={now} /></div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2"><Goals state={state} now={now} /><Activity state={state} now={now} /></div>
    </>
  );
}
