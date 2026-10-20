// Yangi video va rejalashtirish oynalari.
import { Clock } from 'lucide-react';
import { useState } from 'react';
import {
  DAY, FORMATS, HOUR, OWNERS, PLATFORMS, SLOTS, STAGES, TOPICS, at, bestSlots, fmtDur, fmtNum, forecast, fromInputs, readiness, toInputs,
  type Format, type PlatformId, type Stage, type State, type Video,
} from '@/core';
import { useAct, useNow } from '@/lib/data';
import { openVideo, setUI, useUI } from '@/lib/ui';
import { Pf } from './bits';
import { Button } from './ui/button';
import { Modal } from './ui/dialog';
import { Field } from './ui/primitives';

export function Dialogs({ state }: { state: State }) {
  const modal = useUI((s) => s.modal);
  const close = () => setUI({ modal: null });
  return (
    <>
      <Modal open={modal?.type === 'new'} onClose={close} title="Yangi video">{modal?.type === 'new' && <NewVideo onDone={close} />}</Modal>
      <Modal open={modal?.type === 'schedule'} onClose={close} title="Rejalashtirish">
        {modal?.type === 'schedule' && <Schedule state={state} date={modal.date} videoId={modal.videoId} onDone={close} />}
      </Modal>
    </>
  );
}

function NewVideo({ onDone }: { onDone: () => void }) {
  const act = useAct();
  return (
    <form className="grid gap-3.5" onSubmit={async (e) => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
      const { result } = await act.mutateAsync({ type: 'video.create', payload: { title: fd.title, topic: fd.topic, format: fd.format as Format, status: fd.status as Stage, owner: fd.owner, hook: fd.hook } });
      onDone();
      openVideo((result as Video).id, 'script');
    }}>
      <Field label="Sarlavha"><input className="input" name="title" required maxLength={140} autoFocus placeholder="Masalan: 3 ta AI vosita, ishni 2 baravar tezlashtiradi" /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Mavzu"><select className="input" name="topic">{TOPICS.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Format"><select className="input" name="format">{FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
        <Field label="Bosqich"><select className="input" name="status">{STAGES.slice(0, 4).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Mas’ul"><select className="input" name="owner">{OWNERS.map((o) => <option key={o}>{o}</option>)}</select></Field>
      </div>
      <Field label="Hook g‘oyasi (ixtiyoriy)"><input className="input" name="hook" placeholder="Birinchi 3 soniyada nima deyiladi?" /></Field>
      <div className="-mx-[22px] mt-1 flex justify-end gap-2 border-t border-line px-[22px] pt-3.5">
        <Button variant="ghost" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" variant="primary" disabled={act.isPending}>Yaratish</Button>
      </div>
    </form>
  );
}

function Schedule({ state, date, videoId, onDone }: { state: State; date?: number; videoId?: string; onDone: () => void }) {
  const now = useNow(60_000);
  const act = useAct();
  const vids = state.videos.filter((v) => v.status !== 'published').sort((a, b) => readiness(b) - readiness(a));
  const def = toInputs(date ?? Math.max(now + 2 * HOUR, at(now + DAY, 19)));
  const [vid, setVid] = useState(videoId ?? vids[0]?.id ?? '');
  const [pfs, setPfs] = useState<PlatformId[]>(['youtube', 'instagram', 'tiktok']);
  const [d, setD] = useState(def.date);
  const [t, setT] = useState(def.time);
  const v = vids.find((x) => x.id === vid);
  const when = fromInputs(d, t);
  const rows = v ? pfs.map((id) => ({ id, f: forecast(state, now, v, id, when), b: bestSlots(state, now, id, 2) })) : [];
  const tot = rows.reduce((a, r) => ({ mid: a.mid + (r.f?.mid ?? 0), subs: a.subs + (r.f?.subs ?? 0) }), { mid: 0, subs: 0 });
  const tips = [...new Map(rows.flatMap((r) => r.b).map((b) => [b.slot, b])).values()].slice(0, 4);
  const r = v ? readiness(v) : 0;

  return (
    <form className="grid gap-3.5" onSubmit={async (e) => {
      e.preventDefault();
      if (!v || !pfs.length) return;
      if (when < now) return alert('Vaqt o‘tib ketgan — kelajakdagi vaqtni tanlang');
      for (const p of pfs) await act.mutateAsync({ type: 'post.schedule', payload: { videoId: v.id, platform: p, scheduledAt: when } });
      onDone();
    }}>
      <Field label="Video">
        <select className="input" value={vid} onChange={(e) => setVid(e.target.value)} required>
          {vids.map((x) => <option key={x.id} value={x.id}>{x.title} — {Math.round(readiness(x) * 100)}% tayyor</option>)}
        </select>
      </Field>
      <div className="grid gap-1.5">
        <span className="text-xs font-medium text-ink-2">Platformalar</span>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => (
            <label key={p.id} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[9px] border border-line-2 px-[11px] py-[7px] text-[13px] has-checked:border-accent has-checked:bg-accent-wash">
              <input type="checkbox" className="accent-(--accent)" checked={pfs.includes(p.id)} onChange={(e) => setPfs(e.target.checked ? [...pfs, p.id] : pfs.filter((x) => x !== p.id))} />
              <Pf id={p.id} />
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sana"><input className="input" type="date" value={d} onChange={(e) => setD(e.target.value)} required /></Field>
        <Field label="Vaqt (Toshkent)"><input className="input" type="time" value={t} onChange={(e) => setT(e.target.value)} required /></Field>
      </div>
      <div className="rounded-[10px] bg-surface-2 px-3 py-2.5 text-[12.5px] text-ink-2">
        {!v || !pfs.length ? 'Video va kamida bitta platformani tanlang.' : <>
          <b className="text-ink">Prognoz: ~{fmtNum(tot.mid)} ko‘rish, +{fmtNum(tot.subs)} obunachi</b>
          {rows.map((x) => (
            <div key={x.id} className="mt-1.5 flex justify-between gap-2"><Pf id={x.id} /><span>{x.f ? `${fmtNum(x.f.lo)}–${fmtNum(x.f.hi)} · soat omili ${x.f.factors.soat.toFixed(2)}×` : 'ma’lumot yo‘q'}</span></div>
          ))}
          {when < now && <div className="mt-2 text-critical-text">Vaqt o‘tib ketgan — kelajakdagi vaqtni tanlang.</div>}
          {r < 1 && when - now < 2 * DAY && when > now && <div className="mt-2 text-warning">Diqqat: video {Math.round(r * 100)}% tayyor, joylashga {fmtDur(when - now)} qoladi.</div>}
          {tips.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
            {tips.map((b) => { const hh = `${String(SLOTS[b.slot] + 1).padStart(2, '0')}:00`; return <Button key={b.slot} size="sm" onClick={() => setT(hh)}><Clock size={13} />{hh} tavsiya</Button>; })}
          </div>}
        </>}
      </div>
      <div className="-mx-[22px] mt-1 flex justify-end gap-2 border-t border-line px-[22px] pt-3.5">
        <Button variant="ghost" onClick={onDone}>Bekor qilish</Button>
        <Button type="submit" variant="primary" disabled={act.isPending || !v || !pfs.length}>Rejaga qo‘shish</Button>
      </div>
    </form>
  );
}
