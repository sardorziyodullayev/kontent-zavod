// Narxtop bo'limi: ish beruvchi yuboradigan vazifalar (ssenariylar), holati, to'lovlar va Excel hisobot.
// Ikki kishi ishlatadi: ish beruvchi (mijoz roli) va Sardor (admin). Shuning uchun hamma narsa bir qarashda tushunarli bo'lsin.
import { CalendarCheck, CalendarPlus, Check, Download, Layers, RotateCcw, ExternalLink, FileText, MessageSquare, Plus, Search, Send, Trash2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { STATUSES, som, statusName, summarize, type NarxtopData, type Order, type OrderStatus, type Period } from '@/core/narxtop';
import { Button } from '@/components/ui/button';
import { Modal, Sheet } from '@/components/ui/dialog';
import { Card, CardHead, Empty, Field, Meter } from '@/components/ui/primitives';
import { TelegramLink } from '@/components/profile';
import { downloadAuthed, useNarxtop, useNarxtopMutation, type MeInfo } from '@/lib/data';
import { cn, ls } from '@/lib/utils';

/** Telegram xabaridagi havola: …/#/narxtop?v=12 — shu vazifa ochiq holda chiqadi. */
const linkedId = () => Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('v')) || undefined;

const TZ = 5 * 3600_000;
const ymd = (t: number) => new Date(t + TZ).toISOString().slice(0, 10);
const dmy = (t: number) => (t ? ymd(t).split('-').reverse().join('.') : '—');
const fromYmd = (s: string) => (s ? Date.parse(s + 'T12:00:00+05:00') : null);

/** Holat ranglari: yangi — kulrang, ishda — sariq, tekshiruv — ko'k, tuzatish — qizil, tayyor — yashil. */
const TONE: Record<OrderStatus, string> = {
  new: 'bg-surface-3 text-ink-2',
  work: 'bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] text-ink',
  review: 'bg-[color-mix(in_srgb,var(--s-youtube)_22%,transparent)] text-ink',
  fix: 'bg-[color-mix(in_srgb,var(--critical)_20%,transparent)] text-critical-text',
  done: 'bg-[color-mix(in_srgb,var(--good)_22%,transparent)] text-good-text',
};
export function StatusPill({ s, className }: { s: OrderStatus; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-semibold whitespace-nowrap', TONE[s], className)}>{statusName(s)}</span>;
}

const LS_PERIOD = 'kz-narxtop-period';

export function NarxtopPage({ me }: { me: MeInfo | null }) {
  const q = useNarxtop(me !== null);
  const [openId, setOpenId] = useState<number | undefined>(linkedId);
  const [periodId, setPeriodId] = useState<number | null>(() => Number(ls.get(LS_PERIOD)) || null);
  const [filter, setFilter] = useState<OrderStatus | 'all' | 'open'>('open');
  const [text, setText] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);

  if (me === null) return <Card><Empty>Narxtop bo‘limi faqat serverda ishlaydi (demo rejimida yopiq).</Empty></Card>;
  if (q.error) return <Card><p className="text-critical-text">Ma’lumot yuklanmadi: {String((q.error as Error).message)}</p></Card>;
  if (!q.data) return <div className="p-6 text-muted">Yuklanmoqda…</div>;
  const d = q.data;
  const overview = periodId === -1 && d.periods.length > 0;
  const period = overview ? undefined : d.periods.find((p) => p.id === periodId) ?? d.periods[d.periods.length - 1];
  const open = (id?: number) => { setOpenId(id); if (!id && location.hash.includes('?')) history.replaceState(null, '', location.hash.split('?')[0]); };
  // yakunlangan oyda hammasi tayyor: ro'yxat bo'sh 'Bajarilmagan' emas, 'Hammasi' bilan ochiladi
  const pick = (id: number) => { setPeriodId(id); ls.set(LS_PERIOD, String(id)); setFilter(d.periods.find((p) => p.id === id)?.closedAt ? 'all' : 'open'); };
  const current = d.orders.find((o) => o.id === openId);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* 1. Oylar va asosiy tugmalar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 shadow-card" role="tablist" aria-label="Ish oyi">
          {d.periods.length > 1 && (
            <button role="tab" aria-selected={overview} onClick={() => pick(-1)} title="Barcha oylar: natija va to‘lovlar"
              className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-medium text-ink-2 hover:text-ink', overview && 'bg-pill font-semibold text-pill-ink hover:text-pill-ink')}>
              <Layers size={15} />Barcha oylar
            </button>
          )}
          {d.periods.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === period?.id} onClick={() => pick(p.id)} title={p.closedAt ? `Yakunlangan: ${dmy(p.closedAt)}` : 'Joriy oy'}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-medium text-ink-2 hover:text-ink', p.closedAt && 'text-muted',
                p.id === period?.id && 'bg-pill font-semibold text-pill-ink hover:text-pill-ink')}>
              {p.closedAt ? <Check size={14} strokeWidth={2.6} className="text-good-text" /> : <span className="size-2 rounded-full bg-accent ring-2 ring-[var(--accent-wash)]" aria-label="joriy" />}
              {p.name}
            </button>
          ))}
          <button className="flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[13px] text-muted hover:text-ink" onClick={() => setPeriodOpen(true)}><CalendarPlus size={15} />Yangi oy</button>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="dark" onClick={() => downloadAuthed(`/narxtop/report.xlsx?period=${overview ? 'all' : period?.id ?? ''}`, 'narxtop-hisobot.xlsx').catch((e: Error) => alert(e.message))} disabled={!period && !overview}>
            <Download size={16} />{overview ? 'Excel: barcha oylar' : 'Excel hisobot'}
          </Button>
          <Button variant="primary" onClick={() => setNewOpen(true)}><Plus size={17} />Yangi vazifa</Button>
        </div>
      </div>

      {overview ? <MonthsOverview d={d} pick={pick} /> : period ? <PeriodView d={d} period={period} me={me} filter={filter} setFilter={setFilter} text={text} setText={setText} open={open} />
        : <Card><Empty>Hali oy ochilmagan. “Yangi oy” tugmasini bosing yoki birinchi vazifani qo‘shing.</Empty></Card>}

      <NewOrder open={newOpen} onClose={() => setNewOpen(false)} d={d} periodId={period && !period.closedAt ? period.id : undefined} onCreated={(id, pid) => { pick(pid); open(id); }} />
      <NewPeriod open={periodOpen} onClose={() => setPeriodOpen(false)} n={d.periods.length + 1} onCreated={pick} />
      {current && <OrderSheet key={current.id} o={current} d={d} me={me} onClose={() => open()} />}
    </div>
  );
}

function PeriodView({ d, period, me, filter, setFilter, text, setText, open }: {
  d: NarxtopData; period: Period; me: MeInfo; filter: OrderStatus | 'all' | 'open'; setFilter: (f: OrderStatus | 'all' | 'open') => void; text: string; setText: (s: string) => void; open: (id: number) => void;
}) {
  const mut = useNarxtopMutation();
  const os = d.orders.filter((o) => o.periodId === period.id);
  const pays = d.payments.filter((p) => p.periodId === period.id);
  const s = summarize(os, period, pays);
  const num = new Map(os.map((o, i) => [o.id, i + 1]));
  const needle = text.trim().toLowerCase();
  const list = os
    .filter((o) => (filter === 'all' ? true : filter === 'open' ? o.status !== 'done' : o.status === filter))
    .filter((o) => !needle || `${o.title} ${o.direction} ${o.style} ${o.script}`.toLowerCase().includes(needle))
    .reverse();
  const tabs: { id: OrderStatus | 'all' | 'open'; name: string; n: number }[] = [
    { id: 'open', name: 'Bajarilmagan', n: s.open }, { id: 'all', name: 'Hammasi', n: s.total },
    ...STATUSES.map((x) => ({ id: x.id, name: x.name, n: s.byStatus[x.id] })),
  ];

  return (
    <>
      {period.closedAt ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-[color-mix(in_srgb,var(--good)_12%,transparent)] px-4 py-3">
          <CalendarCheck size={18} className="text-good-text" />
          <span className="min-w-0 flex-1 text-[13.5px]"><b>{period.name} yakunlangan</b> · {dmy(period.closedAt)}. Bu oy hisobot uchun saqlanadi, yangi vazifalar joriy oyga yoziladi.</span>
          <Button size="sm" variant="ghost" onClick={() => confirm(`${period.name} qayta ochilsinmi?`) && mut.mutate({ path: `/periods/${period.id}`, method: 'PATCH', body: { closed: false } })}><RotateCcw size={14} />Qayta ochish</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span className="size-2 rounded-full bg-accent" /><span><b className="text-ink">{period.name}</b> — joriy oy</span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => confirm(`${period.name} yakunlansinmi? Oy hisobot uchun saqlanadi; kerak bo‘lsa qayta ochish mumkin.`) && mut.mutate({ path: `/periods/${period.id}`, method: 'PATCH', body: { closed: true } })}>
            <CalendarCheck size={14} />Oyni yakunlash
          </Button>
        </div>
      )}
      {/* 2. Bir qarashda: nechta, nechtasi tayyor, to'lov */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vazifalar" value={s.total} sub={`${period.name}`} />
        <Stat label="Tayyor" value={s.done} sub={s.total ? `${Math.round((s.done / s.total) * 100)}%` : '—'}><Meter value={s.total ? s.done / s.total : 0} className="mt-2" /></Stat>
        <Stat label="Ishda" value={s.open} sub={s.byStatus.fix ? `${s.byStatus.fix} ta tuzatishda` : s.byStatus.new ? `${s.byStatus.new} ta yangi` : 'hammasi joyida'} warn={s.byStatus.fix > 0} />
        <Stat label="To‘lov qoldig‘i" value={s.price ? som(s.left) : '—'} sub={s.price ? `${som(s.paid)} / ${som(s.price)} so‘m` : 'oy summasi kiritilmagan'} />
      </div>

      {!me.tgLinked && me.via === 'session' && (
        <Card className="flex flex-wrap items-center gap-3 border-dashed">
          <Send size={20} className="text-accent-text" />
          <div className="min-w-0 flex-1">
            <b className="block text-[14px]">Vazifani Telegram orqali yuborish</b>
            <span className="text-[13px] text-muted">Botni bir marta ulang — keyin ssenariyni botga yuborsangiz, shu yerda vazifa bo‘lib chiqadi. Video tayyor bo‘lsa, bot xabar beradi.</span>
          </div>
          <TelegramLink />
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* 3. Vazifalar ro'yxati */}
        <Card className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="card-title mr-1">Vazifalar</h2>
            <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-full bg-surface-2 px-3 sm:w-[240px]">
              <Search size={15} className="text-muted" />
              <input className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" placeholder="Qidirish…" value={text} onChange={(e) => setText(e.target.value)} />
            </label>
          </div>
          <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setFilter(t.id)} aria-pressed={filter === t.id}
                className={cn('shrink-0 rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink', filter === t.id && 'border-transparent bg-pill font-semibold text-pill-ink hover:text-pill-ink')}>
                {t.name} <span className="tnum opacity-60">{t.n}</span>
              </button>
            ))}
          </div>
          {!list.length ? <Empty>{os.length ? 'Bu filtrda vazifa yo‘q.' : 'Bu oyda hali vazifa yo‘q. “Yangi vazifa” tugmasini bosing.'}</Empty> : (
            <ul className="grid gap-1.5">
              {list.map((o) => (
                <li key={o.id} className="group flex items-center gap-3 rounded-[16px] border border-line px-3 py-2.5 hover:bg-surface-2">
                  <span className="w-7 shrink-0 text-right font-display text-[13px] text-muted tnum">{num.get(o.id)}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => open(o.id)}>
                    <span className="block truncate text-[14.5px] font-medium">{o.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                      {o.direction && <span>{o.direction}</span>}
                      {o.style && <span>· {o.style}</span>}
                      <span>· {o.source === 'import' ? 'eski jadvaldan' : dmy(o.createdAt)}</span>
                      {o.deadline && o.status !== 'done' && <span className={cn(o.deadline < Date.now() && 'font-semibold text-critical-text')}>· muddat {dmy(o.deadline)}</span>}
                      {o.source === 'telegram' && <span title="Telegram orqali kelgan">· <Send size={11} className="inline" /></span>}
                    </span>
                  </button>
                  {o.videoUrl && <a href={o.videoUrl} target="_blank" rel="noreferrer" className="hidden text-muted hover:text-ink sm:block" title="Videoni ochish"><ExternalLink size={16} /></a>}
                  <select aria-label="Holat" value={o.status} onChange={(e) => mut.mutate({ path: `/orders/${o.id}`, method: 'PATCH', body: { status: e.target.value } })}
                    className={cn('h-8 shrink-0 cursor-pointer appearance-none rounded-full border-0 px-3 text-center text-[12.5px] font-semibold outline-none', TONE[o.status])}>
                    {STATUSES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHead title="Yo‘nalishlar bo‘yicha" />
            {!s.byDirection.length ? <Empty>Hali vazifa yo‘q</Empty> : (
              <table className="w-full text-[13.5px]">
                <thead><tr className="text-left text-[12px] text-muted"><th className="pb-1.5 font-medium">Yo‘nalish</th><th className="pb-1.5 text-right font-medium">Jami</th><th className="pb-1.5 text-right font-medium">Tayyor</th></tr></thead>
                <tbody>
                  {s.byDirection.map((g) => (
                    <tr key={g.name} className="border-t border-line"><td className="py-1.5">{g.name}</td><td className="text-right tnum">{g.total}</td><td className="text-right tnum text-muted">{g.done}</td></tr>
                  ))}
                  <tr className="border-t border-line-2 font-semibold"><td className="py-1.5">Jami</td><td className="text-right tnum">{s.total}</td><td className="text-right tnum">{s.done}</td></tr>
                </tbody>
              </table>
            )}
          </Card>
          <Payments period={period} pays={pays} price={s.price} paid={s.paid} left={s.left} />
        </div>
      </div>
    </>
  );
}

/** Barcha oylar: har oy natijasi va to'lovi bir jadvalda; qatorni bossangiz o'sha oy ochiladi. */
function MonthsOverview({ d, pick }: { d: NarxtopData; pick: (id: number) => void }) {
  const rows = d.periods.map((p) => ({ p, s: summarize(d.orders.filter((o) => o.periodId === p.id), p, d.payments.filter((x) => x.periodId === p.id)) })).reverse();
  const tot = rows.reduce((a, { s }) => ({ total: a.total + s.total, done: a.done + s.done, price: a.price + s.price, paid: a.paid + s.paid, left: a.left + s.left }), { total: 0, done: 0, price: 0, paid: 0, left: 0 });
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Oylar" value={d.periods.length} sub={`${d.periods.filter((p) => p.closedAt).length} tasi yakunlangan`} />
        <Stat label="Jami video" value={tot.total} sub={`${tot.done} tasi tayyor`} />
        <Stat label="Jami to‘langan" value={som(tot.paid)} sub="so‘m" />
        <Stat label="Umumiy qoldiq" value={tot.price ? som(tot.left) : '—'} sub={tot.left ? 'to‘lanmagan' : 'qarz yo‘q'} warn={tot.left > 0} />
      </div>
      <Card className="min-w-0">
        <CardHead title="Oylar bo‘yicha" sub="qatorni bossangiz, o‘sha oy ochiladi" />
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[620px] text-[13.5px]">
            <thead><tr className="text-left text-[12px] text-muted">
              <th className="pb-2 font-medium">Oy</th><th className="pb-2 font-medium">Holat</th><th className="pb-2 text-right font-medium">Video</th><th className="pb-2 text-right font-medium">Tayyor</th>
              <th className="pb-2 text-right font-medium">Summa</th><th className="pb-2 text-right font-medium">To‘langan</th><th className="pb-2 text-right font-medium">Qoldiq</th><th className="pb-2" />
            </tr></thead>
            <tbody>
              {rows.map(({ p, s }) => (
                <tr key={p.id} className="cursor-pointer border-t border-line hover:bg-surface-2" onClick={() => pick(p.id)}>
                  <td className="py-2.5 font-semibold">{p.name}</td>
                  <td>{p.closedAt ? <span className="inline-flex items-center gap-1 text-good-text"><Check size={13} strokeWidth={2.6} />yakunlangan</span> : <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />joriy</span>}</td>
                  <td className="text-right tnum">{s.total}</td>
                  <td className="text-right tnum">{s.done}</td>
                  <td className="text-right tnum">{s.price ? som(s.price) : '—'}</td>
                  <td className="text-right tnum">{som(s.paid)}</td>
                  <td className={cn('text-right tnum', s.left > 0 && 'font-semibold text-critical-text')}>{s.price ? som(s.left) : '—'}</td>
                  <td className="text-right">
                    <Button size="icon-sm" variant="ghost" aria-label={`${p.name} Excel`} title="Shu oy Excel hisoboti" onClick={(e) => { e.stopPropagation(); downloadAuthed(`/narxtop/report.xlsx?period=${p.id}`, 'narxtop-hisobot.xlsx').catch((x: Error) => alert(x.message)); }}><Download size={15} /></Button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line-2 font-semibold">
                <td className="py-2.5">Jami</td><td /><td className="text-right tnum">{tot.total}</td><td className="text-right tnum">{tot.done}</td>
                <td className="text-right tnum">{tot.price ? som(tot.price) : '—'}</td><td className="text-right tnum">{som(tot.paid)}</td><td className="text-right tnum">{tot.price ? som(tot.left) : '—'}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, sub, warn, children }: { label: string; value: ReactNode; sub: string; warn?: boolean; children?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-[12.5px] font-medium text-muted">{label}</div>
      <div className={cn('mt-1 font-display leading-tight font-semibold tracking-[-0.02em] whitespace-nowrap tnum', String(value).length > 8 ? 'text-[20px] sm:text-[22px]' : 'text-[26px]')}>{value}</div>
      <div className={cn('text-[12.5px] text-muted', warn && 'font-semibold text-critical-text')}>{sub}</div>
      {children}
    </Card>
  );
}

function Payments({ period, pays, price, paid, left }: { period: Period; pays: NarxtopData['payments']; price: number; paid: number; left: number }) {
  const mut = useNarxtopMutation();
  const [adding, setAdding] = useState(false);
  const [editPrice, setEditPrice] = useState(false);
  return (
    <Card>
      <CardHead title="To‘lovlar" right={<Button size="sm" onClick={() => setAdding(true)}><Plus size={14} />To‘lov</Button>} />
      <div className="grid gap-1 text-[13.5px]">
        <Row k="Oy summasi" v={editPrice ? (
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); mut.mutate({ path: `/periods/${period.id}`, method: 'PATCH', body: { price: new FormData(e.currentTarget).get('price') } }); setEditPrice(false); }}>
            <input name="price" className="input h-8 w-32 text-right" inputMode="numeric" defaultValue={price || ''} autoFocus />
            <Button size="icon-sm" type="submit" variant="primary" aria-label="Saqlash"><Check size={14} /></Button>
          </form>
        ) : <button className="underline decoration-dotted underline-offset-4 hover:text-ink" onClick={() => setEditPrice(true)}>{price ? `${som(price)} so‘m` : 'kiritish'}</button>} />
        <Row k="To‘langan" v={`${som(paid)} so‘m`} />
        <Row k="Qoldiq" v={<b className={left ? 'text-critical-text' : 'text-good-text'}>{som(left)} so‘m</b>} />
      </div>
      {pays.length > 0 && (
        <ul className="mt-3 grid gap-1 border-t border-line pt-2.5">
          {pays.map((p) => (
            <li key={p.id} className="group flex items-center gap-2 text-[13px]">
              <Wallet size={14} className="shrink-0 text-muted" />
              <span className="text-muted tnum">{dmy(p.paidAt)}</span>
              <b className="tnum">{som(p.amount)}</b>
              <span className="min-w-0 flex-1 truncate text-muted" title={p.note}>{p.note}</span>
              <button className="text-muted opacity-0 group-hover:opacity-100 hover:text-critical-text focus:opacity-100" aria-label="To‘lovni o‘chirish" onClick={() => confirm(`${som(p.amount)} so‘mlik to‘lov o‘chirilsinmi?`) && mut.mutate({ path: `/payments/${p.id}`, method: 'DELETE' })}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title={`To‘lov qo‘shish · ${period.name}`}>
        <form className="grid gap-3.5" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          mut.mutate({ path: '/payments', body: { periodId: period.id, amount: fd.get('amount'), paidAt: fromYmd(String(fd.get('date'))), note: fd.get('note') } }, { onSuccess: () => setAdding(false) });
        }}>
          <Field label="Summa (so‘m)"><input name="amount" className="input h-11 text-[15px]" inputMode="numeric" placeholder="1 000 000" required autoFocus /></Field>
          <Field label="Sana"><input name="date" type="date" className="input h-11" defaultValue={ymd(Date.now())} /></Field>
          <Field label="Izoh (ixtiyoriy)"><input name="note" className="input h-11" placeholder="masalan: avans" /></Field>
          {mut.error && <p className="text-[13px] text-critical-text">{mut.error.message}</p>}
          <Button type="submit" variant="primary" className="h-11 justify-center" disabled={mut.isPending}>Saqlash</Button>
        </form>
      </Modal>
    </Card>
  );
}
const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="flex items-center justify-between gap-2"><span className="text-muted">{k}</span><span className="tnum">{v}</span></div>;

function Choice({ name, options, value, onChange }: { name: string; options: string[]; value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(false);
  if (custom) return <input className="input h-11" autoFocus placeholder={`Yangi ${name.toLowerCase()}`} onBlur={(e) => { onChange(e.target.value); setCustom(false); }} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLInputElement).blur())} />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button type="button" key={o} onClick={() => onChange(value === o ? '' : o)} aria-pressed={value === o}
          className={cn('rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink', value === o && 'border-transparent bg-accent font-semibold text-accent-ink hover:text-accent-ink')}>{o}</button>
      ))}
      <button type="button" onClick={() => setCustom(true)} className="rounded-full border border-dashed border-line-2 px-3 py-1.5 text-[13px] text-muted hover:text-ink">+ boshqa</button>
    </div>
  );
}

function NewOrder({ open, onClose, d, periodId, onCreated }: { open: boolean; onClose: () => void; d: NarxtopData; periodId?: number; onCreated: (id: number, periodId: number) => void }) {
  const mut = useNarxtopMutation();
  const [f, setF] = useState({ title: '', direction: '', style: '', deadline: '' });
  useEffect(() => { if (open) { setF({ title: '', direction: '', style: '', deadline: '' }); mut.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e: FormEvent) => {
    e.preventDefault();
    mut.mutate({ path: '/orders', body: { ...f, periodId, deadline: fromYmd(f.deadline) } }, { onSuccess: (o) => { onClose(); onCreated((o as Order).id, (o as Order).periodId); } });
  };
  return (
    <Modal open={open} onClose={onClose} title="Yangi vazifa" className="w-[min(640px,calc(100vw-32px))]">
      <form className="grid gap-4" onSubmit={submit}>
        <Field label="Vazifa nomi"><input className="input h-12 text-[15px]" autoFocus required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="masalan: Qahramon va NARXTOP" /></Field>
        <div className="grid gap-1.5"><span className="text-xs font-medium text-ink-2">Yo‘nalish</span><Choice name="Yo‘nalish" options={d.directions} value={f.direction} onChange={(v) => setF({ ...f, direction: v })} /></div>
        <div className="grid gap-1.5"><span className="text-xs font-medium text-ink-2">Uslub</span><Choice name="Uslub" options={d.styles} value={f.style} onChange={(v) => setF({ ...f, style: v })} /></div>
        <Field label="Muddat (ixtiyoriy)" className="sm:w-56"><input type="date" className="input h-11" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
        {mut.error && <p className="text-[13px] text-critical-text">{mut.error.message}</p>}
        <Button type="submit" variant="primary" className="h-11 justify-center text-[15px]" disabled={mut.isPending || !f.title.trim()}><Plus size={17} />Vazifani qo‘shish</Button>
        <p className="text-[12.5px] text-muted">Ssenariy kerak bo‘lsa, vazifani ochib keyin qo‘shasiz yoki botga yuborasiz.</p>
      </form>
    </Modal>
  );
}

function NewPeriod({ open, onClose, n, onCreated }: { open: boolean; onClose: () => void; n: number; onCreated: (id: number) => void }) {
  const mut = useNarxtopMutation();
  return (
    <Modal open={open} onClose={onClose} title="Yangi ish oyi">
      <form className="grid gap-3.5" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        mut.mutate({ path: '/periods', body: { name: fd.get('name'), price: fd.get('price') || 0 } }, { onSuccess: (p) => { onCreated((p as Period).id); onClose(); } });
      }}>
        <p className="text-[13px] text-muted">Yangi oy ochilgach, yangi vazifalar shu oyga yoziladi. Oldingi oylar va ularning hisoboti saqlanib qoladi.</p>
        <Field label="Nomi"><input name="name" className="input h-11" defaultValue={`${n}-oy`} required autoFocus /></Field>
        <Field label="Oy uchun kelishilgan summa (so‘m)"><input name="price" className="input h-11" inputMode="numeric" placeholder="5 000 000" /></Field>
        {mut.error && <p className="text-[13px] text-critical-text">{mut.error.message}</p>}
        <Button type="submit" variant="primary" className="h-11 justify-center" disabled={mut.isPending}>Oyni ochish</Button>
      </form>
    </Modal>
  );
}

function OrderSheet({ o, d, me, onClose }: { o: Order; d: NarxtopData; me: MeInfo; onClose: () => void }) {
  const mut = useNarxtopMutation();
  const [f, setF] = useState({ title: o.title, script: o.script, videoUrl: o.videoUrl, note: o.note, deadline: o.deadline ? ymd(o.deadline) : '' });
  const [comment, setComment] = useState('');
  const dirty = f.title !== o.title || f.script !== o.script || f.videoUrl !== o.videoUrl || f.note !== o.note || (f.deadline || null) !== (o.deadline ? ymd(o.deadline) : null);
  const patch = (body: object, after?: () => void) => mut.mutate({ path: `/orders/${o.id}`, method: 'PATCH', body }, { onSuccess: after });
  const period = d.periods.find((p) => p.id === o.periodId);
  const save = () => patch({ ...f, deadline: fromYmd(f.deadline) });
  const nextHint = useMemo(() => {
    if (me.role === 'client') return o.status === 'review' ? 'Videoni ko‘rib chiqing: hammasi to‘g‘ri bo‘lsa “Tayyor”, o‘zgartirish kerak bo‘lsa “Tuzatish” ni bosing va izoh yozing.' : null;
    return o.status === 'new' ? 'Boshlaganingizda “Ishlanmoqda” ni bosing.' : o.status === 'work' || o.status === 'fix' ? 'Video tayyor bo‘lsa, havolasini qo‘ying va “Tekshiruvda” ni bosing — ish beruvchiga xabar boradi.' : null;
  }, [me.role, o.status]);

  return (
    <Sheet open onClose={onClose} title={o.title} header={
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-muted">#{o.id} · {period?.name} · {o.source === 'import' ? 'eski jadvaldan' : dmy(o.createdAt)} · {o.createdBy || '—'}{o.source === 'telegram' ? ' · Telegram' : ''}</div>
          <input className="mt-0.5 w-full bg-transparent font-display text-[19px] font-semibold tracking-[-0.02em] outline-none" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Vazifa nomi" />
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Yopish">✕</Button>
      </div>
    }>
      <div className="grid gap-5 pt-3">
        <section className="grid gap-2">
          <span className="text-xs font-medium text-ink-2">Holat</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((x) => (
              <button key={x.id} title={x.hint} onClick={() => patch({ status: x.id, ...(x.id === 'fix' && comment.trim() ? { comment } : {}) }, () => x.id === 'fix' && setComment(''))}
                className={cn('rounded-full border border-line px-3.5 py-2 text-[13.5px] font-medium text-ink-2 hover:text-ink', o.status === x.id && cn('border-transparent font-semibold', TONE[x.id]))}>
                {o.status === x.id && <Check size={14} className="mr-1 inline" />}{x.name}
              </button>
            ))}
          </div>
          {nextHint && <p className="rounded-xl bg-accent-wash px-3 py-2 text-[13px] text-accent-text">{nextHint}</p>}
        </section>

        <div className="grid gap-1.5"><span className="text-xs font-medium text-ink-2">Yo‘nalish</span><Choice name="Yo‘nalish" options={d.directions} value={o.direction} onChange={(v) => patch({ direction: v })} /></div>
        <div className="grid gap-1.5"><span className="text-xs font-medium text-ink-2">Uslub</span><Choice name="Uslub" options={d.styles} value={o.style} onChange={(v) => patch({ style: v })} /></div>

        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label="Tayyor video havolasi">
            <div className="flex gap-1.5">
              <input className="input h-11 min-w-0 flex-1" value={f.videoUrl} onChange={(e) => setF({ ...f, videoUrl: e.target.value })} placeholder="Google Drive, Telegram yoki YouTube havolasi" />
              {o.videoUrl && <a className="grid size-11 shrink-0 place-items-center rounded-full border border-line hover:bg-surface-2" href={o.videoUrl} target="_blank" rel="noreferrer" aria-label="Ochish"><ExternalLink size={16} /></a>}
            </div>
          </Field>
          <Field label="Muddat"><input type="date" className="input h-11" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
        </div>

        <Field label="Ssenariy"><textarea className="input min-h-[220px] py-2.5 text-[14px] leading-relaxed" value={f.script} onChange={(e) => setF({ ...f, script: e.target.value })} placeholder="Ssenariy matni…" /></Field>
        {o.files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {o.files.map((x, i) => (
              <Button key={i} size="sm" onClick={() => downloadAuthed(`/narxtop/orders/${o.id}/file/${i}`, x.name).catch((e: Error) => alert(e.message))}><FileText size={14} />{x.name}</Button>
            ))}
          </div>
        )}
        <Field label="Izoh (Excel hisobotga ham chiqadi)"><input className="input h-11" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>

        <div className={cn('sticky bottom-0 -mx-1 flex items-center gap-2 bg-surface px-1 py-2 transition-opacity', dirty ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          <Button variant="primary" onClick={save} disabled={mut.isPending}><Check size={16} />O‘zgarishlarni saqlash</Button>
          <Button variant="ghost" onClick={() => setF({ title: o.title, script: o.script, videoUrl: o.videoUrl, note: o.note, deadline: o.deadline ? ymd(o.deadline) : '' })}>Bekor qilish</Button>
        </div>
        {mut.error && <p className="text-[13px] text-critical-text">{mut.error.message}</p>}

        <section className="grid gap-2 border-t border-line pt-4">
          <span className="text-xs font-medium text-ink-2">Izohlar va tarix</span>
          <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (comment.trim()) patch({ comment }, () => setComment('')); }}>
            <input className="input h-11 min-w-0 flex-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Izoh yozing (masalan, nimani tuzatish kerak)…" />
            <Button type="submit" variant="dark" className="h-11" disabled={!comment.trim()}><MessageSquare size={15} />Yuborish</Button>
          </form>
          <ul className="grid gap-1.5">
            {[...o.log].reverse().map((l, i) => (
              <li key={i} className="flex gap-2 text-[13px]">
                <span className="w-[86px] shrink-0 text-muted tnum">{dmy(l.t)} {new Date(l.t + TZ).toISOString().slice(11, 16)}</span>
                <span><b className="font-medium">{l.who}</b> <span className="text-ink-2">{l.text}</span></span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex justify-end border-t border-line pt-3">
          <Button variant="danger" onClick={() => confirm(`“${o.title}” vazifasi o‘chirilsinmi? Bu qaytarilmaydi.`) && mut.mutate({ path: `/orders/${o.id}`, method: 'DELETE' }, { onSuccess: onClose })}>
            <Trash2 size={15} />Vazifani o‘chirish
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
