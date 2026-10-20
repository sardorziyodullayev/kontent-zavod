// Video kartasi: natija, joylashlar (rejalashtirish + prognoz), tayyorlik, ssenariy, izohlar.
import { Check, ExternalLink, Play, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CHECKLIST, DAY, FORMATS, HOUR, OWNERS, PLATFORMS, SCRIPT_TEMPLATES, STAGES, TOPICS, at, fmtDate, fmtDur, fmtFull, fmtNum, fmtTime, forecast, forecastPost,
  fromInputs, pct, pname, postStats, readiness, relDay, toInputs, videoStats, type Action, type PlatformId, type State, type Video,
} from '@/core';
import { useAct, useNow } from '@/lib/data';
import { setUI, useUI } from '@/lib/ui';
import { cn } from '@/lib/utils';
import { MiniStat, Pf, PostTag, pcolor } from './bits';
import { MultiLine } from './line-chart';
import { Button, buttonClass } from './ui/button';
import { Sheet, SheetClose } from './ui/dialog';
import { Field, Meter } from './ui/primitives';

const sel = 'input !h-[30px] !w-auto';

export function VideoSheet({ state }: { state: State }) {
  const drawer = useUI((s) => s.drawer);
  const v = state.videos.find((x) => x.id === drawer?.id);
  const close = () => setUI({ drawer: null });
  return (
    <Sheet open={!!v} onClose={close} title="Video tafsilotlari" header={v ? <Header v={v} /> : null}>
      {v && <Body key={v.id} v={v} state={state} section={drawer?.section} />}
    </Sheet>
  );
}

function Header({ v }: { v: Video }) {
  const act = useAct();
  const upd = (patch: Extract<Action, { type: 'video.update' }>['payload']['patch']) => act.mutate({ type: 'video.update', payload: { id: v.id, patch } });
  return (
    <>
      <div className="flex items-start gap-2.5">
        <input
          key={v.title}
          defaultValue={v.title}
          aria-label="Sarlavha"
          onBlur={(e) => e.target.value.trim() && e.target.value !== v.title && upd({ title: e.target.value.trim() })}
          className="-mx-1.5 -my-1 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 font-display text-[19px] leading-tight font-semibold tracking-[-0.015em] outline-none hover:border-line-2 focus:border-line-2"
        />
        <SheetClose asChild><Button variant="ghost" size="icon" aria-label="Yopish"><X size={18} /></Button></SheetClose>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} aria-label="Bosqich" value={v.status} onChange={(e) => act.mutate({ type: 'video.move', payload: { id: v.id, status: e.target.value as Video['status'] } })}>
          {STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={sel} aria-label="Mavzu" value={v.topic} onChange={(e) => upd({ topic: e.target.value })}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
        <select className={sel} aria-label="Format" value={v.format} onChange={(e) => upd({ format: e.target.value as Video['format'] })}>{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
        <select className={sel} aria-label="Mas’ul" value={v.owner} onChange={(e) => upd({ owner: e.target.value })}>{OWNERS.map((o) => <option key={o}>{o}</option>)}</select>
      </div>
    </>
  );
}

function Sec({ title, right, children, id }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="border-b border-line py-[18px] last:border-b-0">
      <h3 className="mb-3 flex items-center gap-2 font-display text-[12.5px] font-semibold">{title}{right && <span className="ml-auto font-sans">{right}</span>}</h3>
      {children}
    </section>
  );
}

function Body({ v, state, section }: { v: Video; state: State; section?: string }) {
  const now = useNow(60_000);
  const act = useAct();
  const scriptRef = useRef<HTMLElement>(null);
  const readyRef = useRef<HTMLElement>(null);
  useEffect(() => {
    (section === 'script' ? scriptRef : section === 'ready' ? readyRef : null)?.current?.scrollIntoView({ block: 'start' });
  }, [section]);

  const published = v.posts.filter((p) => p.status === 'published' && p.publishedAt);
  const st = videoStats(v.posts, now);
  const r = readiness(v);
  const growth = useMemo(() => {
    if (!published.length) return null;
    const t0 = Math.min(...published.map((p) => p.publishedAt!));
    const horizon = Math.min(14 * DAY, now - t0);
    const step = horizon <= 2 * DAY ? 2 * HOUR : horizon <= 5 * DAY ? 6 * HOUR : 12 * HOUR;
    const pts: number[] = [];
    for (let x = 0; x <= horizon; x += step) pts.push(t0 + x);
    if (pts[pts.length - 1] < t0 + horizon) pts.push(t0 + horizon);
    const ids = [...new Set(published.map((p) => p.platform))];
    return {
      labels: pts.map((x) => { const h = Math.round((x - t0) / HOUR); return h < 48 ? `${h} s` : `${Math.round(h / 24)} k`; }),
      tips: pts.map((x) => `${fmtDate(x)} ${fmtTime(x)} · joylangandan ${fmtDur(x - t0)}`),
      series: ids.map((id) => ({ id, name: pname(id), color: pcolor(id), values: pts.map((x) => published.filter((p) => p.platform === id).reduce((a, p) => a + postStats(p, x).views, 0)) })),
    };
  }, [v, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...v.posts].sort((a, b) => (a.publishedAt ?? a.scheduledAt) - (b.publishedAt ?? b.scheduledAt));

  return (
    <>
      {published.length > 0 && (
        <Sec title="Natija">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <MiniStat k="Ko‘rishlar" v={fmtNum(st.views)} />
            <MiniStat k="+Obunachi" v={`+${fmtNum(st.subs)}`} />
            <MiniStat k="ER" v={pct(st.er)} />
            <MiniStat k="Tomosha" v={pct(st.retention, 0)} />
          </div>
          {growth && <div className="mt-4"><MultiLine labels={growth.labels} tipLabels={growth.tips} series={growth.series} height={210} total aria="Ko‘rishlar o‘sishi (s = soat, k = kun)" /></div>}
          <div className="-mx-4 mt-3.5 overflow-x-auto px-4 sm:-mx-[22px] sm:px-[22px]">
            <table className="table">
              <thead><tr><th>Platforma</th><th>Joylangan</th><th className="r">Ko‘rish</th><th className="r">Layk</th><th className="r">Izoh</th><th className="r">Ulash.</th><th className="r">Saql.</th><th className="r">+Obun.</th></tr></thead>
              <tbody>
                {published.map((p) => { const s = postStats(p, now); return (
                  <tr key={p.id}><td><Pf id={p.platform} /></td><td className="whitespace-nowrap">{fmtDate(p.publishedAt!)}, {fmtTime(p.publishedAt!)}</td><td className="r">{fmtFull(s.views)}</td><td className="r">{fmtFull(s.likes)}</td><td className="r">{fmtFull(s.comments)}</td><td className="r">{fmtFull(s.shares)}</td><td className="r">{fmtFull(s.saves)}</td><td className="r">+{fmtFull(s.subs)}</td></tr>
                ); })}
              </tbody>
            </table>
          </div>
        </Sec>
      )}

      <Sec title={<>Joylashlar <span className="font-sans font-normal text-muted">{v.posts.length}</span></>}>
        {sorted.map((p) => {
          const when = p.publishedAt ?? p.scheduledAt;
          const f = p.status === 'scheduled' ? forecastPost(state, now, v, p) : null;
          const d = toInputs(when);
          return (
            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line py-3 last:border-b-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5"><Pf id={p.platform} /><PostTag s={p.status} /><span className="text-[13px] text-ink-2">{relDay(when, now)}, {fmtTime(when)}</span></div>
                {p.error && <div className="mt-1 text-[12.5px] text-critical-text">{p.error}</div>}
                {f && <div className="mt-1 text-[12.5px] text-muted">Prognoz: <b className="text-ink-2">{fmtNum(f.lo)}–{fmtNum(f.hi)}</b> ko‘rish, <b className="text-ink-2">+{fmtNum(f.subs)}</b> obunachi</div>}
                {p.status === 'scheduled' && (
                  <form className="mt-2 flex gap-1.5" onChange={(e) => {
                    const fm = e.currentTarget as HTMLFormElement;
                    const t = fromInputs((fm.elements.namedItem('date') as HTMLInputElement).value, (fm.elements.namedItem('time') as HTMLInputElement).value);
                    if (t && t !== p.scheduledAt) act.mutate({ type: 'post.reschedule', payload: { postId: p.id, scheduledAt: t } });
                  }}>
                    <input className={sel} type="date" name="date" defaultValue={d.date} aria-label="Sana" />
                    <input className={sel} type="time" name="time" defaultValue={d.time} aria-label="Vaqt" />
                  </form>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-1.5">
                {p.status === 'scheduled' && <>
                  <Button size="sm" onClick={() => confirm('Hozir joylansinmi? Tayyorlik ro‘yxati to‘liq belgilanadi.') && act.mutate({ type: 'post.publishNow', payload: { postId: p.id } })}><Play size={14} />Hozir</Button>
                  <Button size="icon-sm" variant="danger" aria-label="Rejadan olib tashlash" onClick={() => confirm('Rejadan olib tashlansinmi?') && act.mutate({ type: 'post.remove', payload: { postId: p.id } })}><Trash2 size={14} /></Button>
                </>}
                {(p.status === 'failed' || p.status === 'missed') && <>
                  <Button size="sm" onClick={() => act.mutate({ type: 'post.retry', payload: { postId: p.id } })}><RefreshCw size={14} />Qayta urinish</Button>
                  <Button size="icon-sm" variant="danger" aria-label="O‘chirish" onClick={() => act.mutate({ type: 'post.remove', payload: { postId: p.id } })}><Trash2 size={14} /></Button>
                </>}
                {p.status === 'published' && p.url && <a className={buttonClass('ghost', 'sm')} href={p.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Havola</a>}
              </div>
            </div>
          );
        })}
        {!v.posts.length && <p className="text-muted">Hali rejalashtirilmagan</p>}
        <AddPost v={v} state={state} now={now} />
      </Sec>

      <Sec id="sec-ready" title="Tayyorlik" right={<b className="text-ink-2">{Math.round(r * 100)}%</b>}>
        <section ref={readyRef}>
          <Meter value={r} className="mb-3" />
          <div className="grid gap-1.5 sm:grid-cols-2">
            {CHECKLIST.map((c) => {
              const on = v.checklist[c.id];
              return (
                <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-[9px] border border-transparent bg-surface-2 px-[11px] py-[9px] hover:border-line-2">
                  <input type="checkbox" className="peer sr-only" checked={on} onChange={(e) => act.mutate({ type: 'video.check', payload: { id: v.id, key: c.id, value: e.target.checked } })} />
                  <span className={cn('grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] peer-focus-visible:outline-2 peer-focus-visible:outline-accent', on ? 'border-accent bg-accent text-accent-ink' : 'border-line-2 text-transparent')}><Check size={13} strokeWidth={3} /></span>
                  <span className={on ? 'text-ink-2' : ''}>{c.name}</span>
                </label>
              );
            })}
          </div>
        </section>
      </Sec>

      <Sec id="sec-script" title="Ssenariy" right={
        <select className={sel} value="" aria-label="Shablon" onChange={(e) => {
          const t = SCRIPT_TEMPLATES.find((x) => x.id === e.target.value);
          if (t) act.mutate({ type: 'video.update', payload: { id: v.id, patch: { script: { template: t.id, hook: t.hook, body: t.body, cta: t.cta } } } });
        }}>
          <option value="">Shablon qo‘llash…</option>
          {SCRIPT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      }>
        <section ref={scriptRef}><ScriptEditor key={v.script.template + v.script.hook} v={v} /></section>
      </Sec>

      <Sec title="Izohlar">
        <textarea className="input" rows={3} defaultValue={v.notes} placeholder="Jamoa uchun eslatmalar, havolalar, musiqa manbasi…" onBlur={(e) => e.target.value !== v.notes && act.mutate({ type: 'video.update', payload: { id: v.id, patch: { notes: e.target.value } } })} />
      </Sec>

      <section className="flex flex-wrap justify-between gap-2 py-[18px]">
        <span className="text-[12.5px] text-muted">ID: {v.id} · yaratildi {fmtDate(v.createdAt)}</span>
        <Button size="sm" variant="danger" onClick={() => { if (confirm('Video butunlay o‘chirilsinmi? Buni qaytarib bo‘lmaydi.')) { setUI({ drawer: null }); act.mutate({ type: 'video.delete', payload: { id: v.id } }); } }}><Trash2 size={14} />Videoni o‘chirish</Button>
      </section>
    </>
  );
}

function AddPost({ v, state, now }: { v: Video; state: State; now: number }) {
  const act = useAct();
  const free = PLATFORMS.filter((p) => !v.posts.some((x) => x.platform === p.id && (x.status === 'scheduled' || x.status === 'published')));
  const def = toInputs(Math.max(now + 2 * HOUR, at(now + DAY, 19)));
  const [platform, setPlatform] = useState<PlatformId | ''>(free[0]?.id ?? '');
  const [date, setDate] = useState(def.date);
  const [time, setTime] = useState(def.time);
  const when = fromInputs(date, time);
  const f = platform && when ? forecast(state, now, v, platform, when) : null;
  if (!free.length) return null;
  return (
    <form className="mt-3" onSubmit={(e) => {
      e.preventDefault();
      if (!platform) return;
      if (when < now) return alert('Vaqt o‘tib ketgan');
      act.mutate({ type: 'post.schedule', payload: { videoId: v.id, platform, scheduledAt: when } });
    }}>
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1.1fr_1fr_0.8fr_auto]">
        <Field label="Platforma"><select className="input" value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)}>{free.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Sana"><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
        <Field label="Vaqt"><input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required /></Field>
        <Button type="submit" variant="primary"><Plus size={15} />Qo‘shish</Button>
      </div>
      {f && <p className="mt-2 text-[12.5px] text-muted">Shu vaqt uchun prognoz: <b className="text-ink-2">{fmtNum(f.lo)}–{fmtNum(f.hi)}</b> ko‘rish (median {fmtNum(f.mid)}), +{fmtNum(f.subs)} obunachi · ishonch: {f.confidence}</p>}
    </form>
  );
}

function ScriptEditor({ v }: { v: Video }) {
  const act = useAct();
  const [s, setS] = useState(v.script);
  const save = (k: keyof typeof s) => s[k] !== v.script[k] && act.mutate({ type: 'video.update', payload: { id: v.id, patch: { script: { [k]: s[k] } } } });
  const words = [s.hook, s.body, s.cta].join(' ').split(/\s+/).filter(Boolean).length;
  const hookWords = s.hook.split(/\s+/).filter(Boolean).length;
  const bind = (k: keyof typeof s) => ({ value: s[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setS({ ...s, [k]: e.target.value }), onBlur: () => save(k) });
  return (
    <div className="grid gap-3">
      <Field label="Hook — birinchi 2–3 soniya"><input className="input" placeholder="Tomoshabinni to‘xtatadigan birinchi gap" {...bind('hook')} /></Field>
      <Field label="Asosiy qism"><textarea className="input" rows={6} placeholder="Kadrma-kadr yoki punktlar bilan" {...bind('body')} /></Field>
      <Field label="CTA — chaqiriq"><input className="input" placeholder="Obuna bo‘ling, saqlang, izoh qoldiring…" {...bind('cta')} /></Field>
      <div className="flex flex-wrap gap-3.5 text-[12.5px] text-ink-2">
        <span>So‘zlar: <b className="text-ink">{words}</b></span>
        <span>Taxminiy davomiylik: <b className="text-ink">{Math.round(words / 2.5)} s</b> <span className="text-muted">(maqsad ~{v.duration} s)</span></span>
        <span>Hook: <b className={hookWords > 12 ? 'text-critical-text' : 'text-ink'}>{hookWords} so‘z</b>{hookWords > 12 && ' — qisqartiring (≤12)'}</span>
      </div>
      <Field label="Tavsif (caption)"><textarea className="input" rows={3} {...bind('description')} /></Field>
      <Field label="Hashtaglar"><input className="input" {...bind('hashtags')} /></Field>
    </div>
  );
}
