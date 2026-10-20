import { CalendarDays, Clock, Film, Sparkles, TrendingUp, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  DAY, DOW_NAMES, DOW_SHORT, FORMATS, PLATFORMS, PLATFORM_IDS, SLOTS, TOPICS, allPosts, dayStart, engagement, fmtDate, fmtFull, fmtNum, fmtTime, followersAt,
  insights, pct, pname, postStats, slotLabel, slotMatrix, type Insight, type PlatformId,
} from '@/core';
import { BarRow, MiniStat, Pf, pcolor } from '@/components/bits';
import { MultiLine } from '@/components/line-chart';
import { useAppState } from '@/components/shell';
import { Card, CardHead, Empty } from '@/components/ui/primitives';
import { useNow } from '@/lib/data';
import { openVideo, pfList, useUI } from '@/lib/ui';
import { PeriodFilters } from './dashboard';

const IIC: Record<Insight['kind'], typeof Clock> = { time: Clock, topic: Sparkles, subs: TrendingUp, format: Film, hook: Zap, cadence: CalendarDays };

function Heatmap({ now }: { now: number }) {
  const { state } = useAppState();
  const [pf, setPf] = useState<'all' | PlatformId>('all');
  const hm = useMemo(() => slotMatrix(state, now, pf === 'all' ? PLATFORM_IDS : [pf]), [state, now, pf]);
  const hmax = Math.max(1.5, ...hm.flat().filter(Boolean).map((c) => c!.idx));
  const step = (x: number) => Math.max(1, Math.min(6, Math.round((x / hmax) * 6)));
  const [tip, setTip] = useState<string | null>(null);
  return (
    <Card>
      <CardHead title="Qachon joylash kerak" sub="medianaga nisbatan, 2 soatlik bloklar" right={
        <select className="input !h-[34px] !w-auto" aria-label="Platforma" value={pf} onChange={(e) => setPf(e.target.value as typeof pf)}>
          <option value="all">Barcha platformalar</option>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>} />
      <div className="grid grid-cols-[34px_repeat(9,minmax(0,1fr))] gap-[3px] text-[11px]" role="table" aria-label="Kun va soat bo‘yicha natija">
        <span />
        {SLOTS.map((h) => <span key={h} className="pb-1 text-center text-muted">{String(h).padStart(2, '0')}</span>)}
        {hm.map((row, d) => [
          <span key={`l${d}`} className="flex items-center text-muted">{DOW_SHORT[d]}</span>,
          ...row.map((c, s) => {
            const label = `${DOW_NAMES[d]}, ${slotLabel(s)}: ${c ? `${c.idx >= 1 ? '+' : ''}${Math.round((c.idx - 1) * 100)}% medianaga nisbatan, ${c.n} ta post` : 'hali joylanmagan'}`;
            return (
              <span key={`${d}-${s}`} title={label} onMouseEnter={() => setTip(label)} onMouseLeave={() => setTip(null)}
                className={c ? 'grid h-[34px] place-items-center rounded-[5px] text-transparent tnum hover:text-ink hover:outline-2 hover:outline-offset-1 hover:outline-ink' : 'h-[34px] rounded-[5px] border border-dashed border-line'}
                style={c ? { background: `var(--seq-${step(c.idx)})` } : undefined}>
                {c ? `${c.idx.toFixed(1)}×` : ''}
              </span>
            );
          }),
        ])}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
        <span>past</span><span className="flex gap-0.5">{[1, 2, 3, 4, 5, 6].map((i) => <i key={i} className="h-2 w-[22px] rounded-sm" style={{ background: `var(--seq-${i})` }} />)}</span><span>yuqori</span>
        <span className="ml-auto text-ink-2">{tip ?? 'Katakka olib boring — tafsilot'}</span>
      </div>
    </Card>
  );
}

export function AnalyticsPage() {
  const { state } = useAppState();
  const now = useNow(60_000);
  const period = useUI((s) => s.period);
  const pf = useUI((s) => s.pf);
  const pfs = pfList(pf, PLATFORM_IDS);

  const d = useMemo(() => {
    const posts = allPosts(state).filter(({ p }) => p.status === 'published' && pfs.includes(p.platform) && p.publishedAt! >= now - period * DAY).map(({ v, p }) => ({ v, p, s: postStats(p, now) }));
    const agg = (g: typeof posts) => {
      const views = g.reduce((a, x) => a + x.s.views, 0);
      return { n: g.length, avg: g.length ? views / g.length : 0, subs1k: views ? (g.reduce((a, x) => a + x.s.subs, 0) / views) * 1000 : 0, er: views ? g.reduce((a, x) => a + engagement(x.s), 0) / views : 0, ret: views ? g.reduce((a, x) => a + x.s.retention * x.s.views, 0) / views : 0 };
    };
    const fdays: number[] = [];
    for (let x = dayStart(now - (period - 1) * DAY); x <= now; x += DAY) fdays.push(Math.min(x + DAY, now));
    return {
      posts,
      fmt: FORMATS.map((f) => ({ ...f, ...agg(posts.filter((x) => x.v.format === f.id)) })),
      topics: TOPICS.map((t) => ({ t, ...agg(posts.filter((x) => x.v.topic === t)) })).sort((a, b) => b.avg - a.avg),
      conv: PLATFORMS.filter((p) => pfs.includes(p.id)).map((p) => ({ ...p, ...agg(posts.filter((x) => x.p.platform === p.id)) })),
      top: [...posts].sort((a, b) => b.s.views - a.s.views).slice(0, 10),
      fol: { labels: fdays.map((x) => fmtDate(x)), series: pfs.map((id) => ({ id, name: pname(id), color: pcolor(id), values: fdays.map((x) => followersAt(state, id, x)) })) },
      ins: insights(state, now),
    };
  }, [state, now, period, pf]); // eslint-disable-line react-hooks/exhaustive-deps

  const tmax = Math.max(1, ...d.topics.map((x) => x.avg));
  const cmax = Math.max(1, ...d.conv.map((x) => x.subs1k));

  return (
    <>
      <div className="mb-4"><PeriodFilters count={`${d.posts.length} ta post tahlil qilindi`} /></div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHead title="Tavsiyalar" sub="ma’lumotlardan avtomatik" />
          {d.ins.map((i, k) => { const I = IIC[i.kind]; return (
            <div key={k} className="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-line py-[13px] last:border-b-0">
              <span className="grid size-7 place-items-center rounded-lg bg-accent-wash text-accent-text"><I size={15} /></span><p className="mt-[3px]">{i.text}</p>
            </div>
          ); })}
          {!d.ins.length && <Empty>Tavsiya uchun ma’lumot yetarli emas</Empty>}
        </Card>
        <div className="grid content-start gap-4">
          {d.fmt.map((f) => (
            <Card key={f.id}>
              <CardHead title={f.name} sub={`${f.n} ta post`} />
              <div className="grid grid-cols-2 gap-2.5">
                <MiniStat k="O‘rtacha ko‘rish" v={fmtNum(f.avg)} /><MiniStat k="Obunachi / 1000" v={f.subs1k.toFixed(1)} />
                <MiniStat k="ER" v={pct(f.er)} /><MiniStat k="Tomosha" v={pct(f.ret, 0)} />
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Heatmap now={now} />
        <Card>
          <CardHead title="Mavzular" sub="o‘rtacha ko‘rish / post" />
          <div className="grid gap-3">{d.topics.map((x) => <BarRow key={x.t} labelWidth={130} label={x.t} value={x.avg} max={tmax} display={fmtNum(x.avg)} color="var(--seq-4)" title={`${x.n} ta post · ${x.subs1k.toFixed(1)} obunachi / 1000 ko‘rish`} />)}</div>
          <CardHead className="mt-[22px]" title="Obunachiga aylanish" sub="har 1000 ko‘rishga yangi obunachi" />
          <div className="grid gap-3">{d.conv.map((c) => <BarRow key={c.id} label={<Pf id={c.id} />} value={c.subs1k} max={cmax} display={c.subs1k.toFixed(1)} color={pcolor(c.id)} />)}</div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHead title="Obunachilar soni" sub={`${period} kun`} />
        <MultiLine labels={d.fol.labels} series={d.fol.series} height={260} aria="Obunachilar soni" />
      </Card>

      <Card className="mt-4">
        <CardHead title="Eng yaxshi 10 ta post" sub={`${period} kun ichida joylanganlar`} />
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="table">
            <thead><tr><th>#</th><th>Video</th><th>Platforma</th><th>Joylangan</th><th className="r">Ko‘rish</th><th className="r">ER</th><th className="r">Tomosha</th><th className="r">+Obun.</th></tr></thead>
            <tbody>
              {d.top.map((x, i) => (
                <tr key={x.p.id} className="click" onClick={() => openVideo(x.v.id)}>
                  <td className="text-muted">{i + 1}</td><td><span className="block max-w-[340px] truncate font-medium">{x.v.title}</span><span className="text-xs text-muted">{x.v.topic}</span></td>
                  <td><Pf id={x.p.platform} /></td><td className="whitespace-nowrap">{fmtDate(x.p.publishedAt!, { weekday: true })}, {fmtTime(x.p.publishedAt!)}</td>
                  <td className="r">{fmtFull(x.s.views)}</td><td className="r">{pct(engagement(x.s) / (x.s.views || 1))}</td><td className="r">{pct(x.s.retention, 0)}</td><td className="r">+{fmtFull(x.s.subs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
