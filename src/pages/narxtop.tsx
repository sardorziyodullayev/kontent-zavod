// Narxtop bo'limi: ish beruvchi yuboradigan vazifalar (ssenariylar), holati, to'lovlar va Excel hisobot.
// Ikki kishi ishlatadi: ish beruvchi (mijoz roli, odatda rus tilida) va Sardor (admin). Hamma narsa bir qarashda tushunarli bo'lsin.
import { CalendarCheck, CalendarPlus, Check, Download, ExternalLink, FileText, Layers, MessageSquare, Plus, RotateCcw, Search, Send, Trash2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { STATUSES, label, logLabel, som, statusHint, statusLabel, summarize, type NarxtopData, type Order, type OrderStatus, type Period } from '@/core/narxtop';
import { Button } from '@/components/ui/button';
import { Modal, Sheet } from '@/components/ui/dialog';
import { Card, CardHead, Empty, Field, Meter } from '@/components/ui/primitives';
import { TelegramLink } from '@/components/profile';
import { downloadAuthed, useNarxtop, useNarxtopMutation, type MeInfo } from '@/lib/data';
import { L, lang } from '@/lib/lang';
import { cn, ls } from '@/lib/utils';

/** Telegram xabaridagi havola: …/#/narxtop?v=12 — shu vazifa ochiq holda chiqadi. */
const linkedId = () => Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('v')) || undefined;

const TZ = 5 * 3600_000;
const ymd = (t: number) => new Date(t + TZ).toISOString().slice(0, 10);
const dmy = (t: number) => (t ? ymd(t).split('-').reverse().join('.') : '—');
const fromYmd = (s: string) => (s ? Date.parse(s + 'T12:00:00+05:00') : null);
const cur = () => L('so‘m', 'сум');
const nm = (s: string) => label(s, lang());
const st = (s: OrderStatus) => statusLabel(s, lang());

/** Holat ranglari: yangi — kulrang, ishda — sariq, tekshiruv — ko'k, tuzatish — qizil, tayyor — yashil. */
const TONE: Record<OrderStatus, string> = {
  new: 'bg-surface-3 text-ink-2',
  work: 'bg-[color-mix(in_srgb,var(--warning)_22%,transparent)] text-ink',
  review: 'bg-[color-mix(in_srgb,var(--s-youtube)_22%,transparent)] text-ink',
  fix: 'bg-[color-mix(in_srgb,var(--critical)_20%,transparent)] text-critical-text',
  done: 'bg-[color-mix(in_srgb,var(--good)_22%,transparent)] text-good-text',
};

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
  if (q.error) return <Card><p className="text-critical-text">{L('Ma’lumot yuklanmadi', 'Не удалось загрузить данные')}: {String((q.error as Error).message)}</p></Card>;
  if (!q.data) return <div className="p-6 text-muted">{L('Yuklanmoqda…', 'Загрузка…')}</div>;
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
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface p-1 shadow-card" role="tablist" aria-label={L('Ish oyi', 'Месяц')}>
          {d.periods.length > 1 && (
            <button role="tab" aria-selected={overview} onClick={() => pick(-1)} title={L('Barcha oylar: natija va to‘lovlar', 'Все месяцы: итоги и оплаты')}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-medium text-ink-2 hover:text-ink', overview && 'bg-pill font-semibold text-pill-ink hover:text-pill-ink')}>
              <Layers size={15} />{L('Barcha oylar', 'Все месяцы')}
            </button>
          )}
          {d.periods.map((p) => (
            <button key={p.id} role="tab" aria-selected={p.id === period?.id} onClick={() => pick(p.id)} title={p.closedAt ? `${L('Yakunlangan', 'Завершён')}: ${dmy(p.closedAt)}` : L('Joriy oy', 'Текущий месяц')}
              className={cn('flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13.5px] font-medium text-ink-2 hover:text-ink', p.closedAt && 'text-muted',
                p.id === period?.id && 'bg-pill font-semibold text-pill-ink hover:text-pill-ink')}>
              {p.closedAt ? <Check size={14} strokeWidth={2.6} className="text-good-text" /> : <span className="size-2 rounded-full bg-accent ring-2 ring-[var(--accent-wash)]" />}
              {periodName(p.name)}
            </button>
          ))}
          <button className="flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-[13px] text-muted hover:text-ink" onClick={() => setPeriodOpen(true)}><CalendarPlus size={15} />{L('Yangi oy', 'Новый месяц')}</button>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="dark" onClick={() => downloadAuthed(`/narxtop/report.xlsx?period=${overview ? 'all' : period?.id ?? ''}`, 'narxtop-report.xlsx').catch((e: Error) => alert(e.message))} disabled={!period && !overview}>
            <Download size={16} />{overview ? L('Excel: barcha oylar', 'Excel: все месяцы') : L('Excel hisobot', 'Отчёт Excel')}
          </Button>
          <Button variant="primary" onClick={() => setNewOpen(true)}><Plus size={17} />{L('Yangi vazifa', 'Новая задача')}</Button>
        </div>
      </div>

      {overview ? <MonthsOverview d={d} pick={pick} /> : period ? <PeriodView d={d} period={period} me={me} filter={filter} setFilter={setFilter} text={text} setText={setText} open={open} />
        : <Card><Empty>{L('Hali oy ochilmagan. “Yangi oy” tugmasini bosing yoki birinchi vazifani qo‘shing.', 'Месяц ещё не открыт. Нажмите «Новый месяц» или добавьте первую задачу.')}</Empty></Card>}

      <NewOrder open={newOpen} onClose={() => setNewOpen(false)} d={d} periodId={period && !period.closedAt ? period.id : undefined} onCreated={(id, pid) => { pick(pid); open(id); }} />
      <NewPeriod open={periodOpen} onClose={() => setPeriodOpen(false)} n={d.periods.length + 1} onCreated={pick} />
      {current && <OrderSheet key={current.id} o={current} d={d} me={me} onClose={() => open()} />}
    </div>
  );
}

/** "2-oy" → "2-й месяц" (rus tilida); boshqa nomlar o'zgarmaydi. */
const periodName = (name: string) => (lang() === 'ru' ? name.replace(/^(\d+)-oy$/, '$1-й месяц') : name);

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
    .filter((o) => !needle || `${o.title} ${o.direction} ${nm(o.direction)} ${o.style} ${o.script}`.toLowerCase().includes(needle))
    .reverse();
  const tabs: { id: OrderStatus | 'all' | 'open'; name: string; n: number }[] = [
    { id: 'open', name: L('Bajarilmagan', 'Невыполненные'), n: s.open }, { id: 'all', name: L('Hammasi', 'Все'), n: s.total },
    ...STATUSES.map((x) => ({ id: x.id, name: st(x.id), n: s.byStatus[x.id] })),
  ];
  const pn = periodName(period.name);

  return (
    <>
      {period.closedAt ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[18px] bg-[color-mix(in_srgb,var(--good)_12%,transparent)] px-4 py-3">
          <CalendarCheck size={18} className="text-good-text" />
          <span className="min-w-0 flex-1 text-[13.5px]"><b>{pn} {L('yakunlangan', 'завершён')}</b> · {dmy(period.closedAt)}. {L('Bu oy hisobot uchun saqlanadi, yangi vazifalar joriy oyga yoziladi.', 'Месяц сохранён для отчёта, новые задачи попадают в текущий месяц.')}</span>
          <Button size="sm" variant="ghost" onClick={() => confirm(L(`${pn} qayta ochilsinmi?`, `Открыть ${pn} снова?`)) && mut.mutate({ path: `/periods/${period.id}`, method: 'PATCH', body: { closed: false } })}><RotateCcw size={14} />{L('Qayta ochish', 'Открыть снова')}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          <span className="size-2 rounded-full bg-accent" /><span><b className="text-ink">{pn}</b> — {L('joriy oy', 'текущий месяц')}</span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => confirm(L(`${pn} yakunlansinmi? Oy hisobot uchun saqlanadi; kerak bo‘lsa qayta ochish mumkin.`, `Завершить ${pn}? Месяц сохранится для отчёта; при необходимости его можно открыть снова.`)) && mut.mutate({ path: `/periods/${period.id}`, method: 'PATCH', body: { closed: true } })}>
            <CalendarCheck size={14} />{L('Oyni yakunlash', 'Завершить месяц')}
          </Button>
        </div>
      )}
      {/* 2. Bir qarashda: nechta, nechtasi tayyor, to'lov */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={L('Vazifalar', 'Задачи')} value={s.total} sub={pn} />
        <Stat label={L('Tayyor', 'Готово')} value={s.done} sub={s.total ? `${Math.round((s.done / s.total) * 100)}%` : '—'}><Meter value={s.total ? s.done / s.total : 0} className="mt-2" /></Stat>
        <Stat label={L('Ishda', 'В работе')} value={s.open} warn={s.byStatus.fix > 0}
          sub={s.byStatus.fix ? L(`${s.byStatus.fix} ta tuzatishda`, `на правках: ${s.byStatus.fix}`) : s.byStatus.new ? L(`${s.byStatus.new} ta yangi`, `новых: ${s.byStatus.new}`) : L('hammasi joyida', 'всё в порядке')} />
        <Stat label={L('To‘lov qoldig‘i', 'Остаток оплаты')} value={s.price ? som(s.left) : '—'} sub={s.price ? `${som(s.paid)} / ${som(s.price)} ${cur()}` : L('oy summasi kiritilmagan', 'сумма месяца не указана')} warn={s.left > 0} />
      </div>

      <Payments period={period} pays={pays} price={s.price} paid={s.paid} left={s.left} pending={s.pending} me={me} />

      {!me.tgLinked && me.via === 'session' && (
        <Card className="flex flex-wrap items-center gap-3 border-dashed">
          <Send size={20} className="text-accent-text" />
          <div className="min-w-0 flex-1">
            <b className="block text-[14px]">{L('Vazifani Telegram orqali yuborish', 'Отправка задач через Telegram')}</b>
            <span className="text-[13px] text-muted">{L('Botni bir marta ulang — keyin ssenariyni botga yuborsangiz, shu yerda vazifa bo‘lib chiqadi. Video tayyor bo‘lsa, bot xabar beradi.', 'Подключите бота один раз — после этого сценарий, отправленный боту, появится здесь как задача. Когда видео будет готово, бот сообщит.')}</span>
          </div>
          <TelegramLink />
        </Card>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* 3. Vazifalar ro'yxati */}
        <Card className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="card-title mr-1">{L('Vazifalar', 'Задачи')}</h2>
            <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-full bg-surface-2 px-3 sm:w-[240px]">
              <Search size={15} className="text-muted" />
              <input className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" placeholder={L('Qidirish…', 'Поиск…')} value={text} onChange={(e) => setText(e.target.value)} />
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
          {!list.length ? <Empty>{os.length ? L('Bu filtrda vazifa yo‘q.', 'В этом фильтре задач нет.') : L('Bu oyda hali vazifa yo‘q. “Yangi vazifa” tugmasini bosing.', 'В этом месяце задач пока нет. Нажмите «Новая задача».')}</Empty> : (
            <ul className="grid gap-1.5">
              {list.map((o) => (
                <li key={o.id} className="group flex items-center gap-3 rounded-[16px] border border-line px-3 py-2.5 hover:bg-surface-2">
                  <span className="w-7 shrink-0 text-right font-display text-[13px] text-muted tnum">{num.get(o.id)}</span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => open(o.id)}>
                    <span className="block truncate text-[14.5px] font-medium">{o.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                      {o.direction && <span>{nm(o.direction)}</span>}
                      {o.style && <span>· {nm(o.style)}</span>}
                      <span>· {o.source === 'import' ? L('eski jadvaldan', 'из старой таблицы') : dmy(o.createdAt)}</span>
                      {o.deadline && o.status !== 'done' && <span className={cn(o.deadline < Date.now() && 'font-semibold text-critical-text')}>· {L('muddat', 'срок')} {dmy(o.deadline)}</span>}
                      {o.source === 'telegram' && <span title="Telegram">· <Send size={11} className="inline" /></span>}
                    </span>
                  </button>
                  {o.videoUrl && <a href={o.videoUrl} target="_blank" rel="noreferrer" className="hidden text-muted hover:text-ink sm:block" title={L('Videoni ochish', 'Открыть видео')}><ExternalLink size={16} /></a>}
                  <select aria-label={L('Holat', 'Статус')} value={o.status} onChange={(e) => mut.mutate({ path: `/orders/${o.id}`, method: 'PATCH', body: { status: e.target.value } })}
                    className={cn('h-8 shrink-0 cursor-pointer appearance-none rounded-full border-0 px-3 text-center text-[12.5px] font-semibold outline-none', TONE[o.status])}>
                    {STATUSES.map((x) => <option key={x.id} value={x.id}>{st(x.id)}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHead title={L('Yo‘nalishlar bo‘yicha', 'По направлениям')} />
            {!s.byDirection.length ? <Empty>{L('Hali vazifa yo‘q', 'Задач пока нет')}</Empty> : (
              <table className="w-full text-[13.5px]">
                <thead><tr className="text-left text-[12px] text-muted"><th className="pb-1.5 font-medium">{L('Yo‘nalish', 'Направление')}</th><th className="pb-1.5 text-right font-medium">{L('Jami', 'Всего')}</th><th className="pb-1.5 text-right font-medium">{L('Tayyor', 'Готово')}</th></tr></thead>
                <tbody>
                  {s.byDirection.map((g) => (
                    <tr key={g.name} className="border-t border-line"><td className="py-1.5">{nm(g.name)}</td><td className="text-right tnum">{g.total}</td><td className="text-right tnum text-muted">{g.done}</td></tr>
                  ))}
                  <tr className="border-t border-line-2 font-semibold"><td className="py-1.5">{L('Jami', 'Итого')}</td><td className="text-right tnum">{s.total}</td><td className="text-right tnum">{s.done}</td></tr>
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/** Barcha oylar: har oy natijasi va to'lovi bir jadvalda; qatorni bossangiz o'sha oy ochiladi. */
function MonthsOverview({ d, pick }: { d: NarxtopData; pick: (id: number) => void }) {
  const rows = d.periods.map((p) => ({ p, s: summarize(d.orders.filter((o) => o.periodId === p.id), p, d.payments.filter((x) => x.periodId === p.id)) })).reverse();
  const tot = rows.reduce((a, { s }) => ({ total: a.total + s.total, done: a.done + s.done, price: a.price + s.price, paid: a.paid + s.paid, left: a.left + s.left }), { total: 0, done: 0, price: 0, paid: 0, left: 0 });
  const closed = d.periods.filter((p) => p.closedAt).length;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={L('Oylar', 'Месяцы')} value={d.periods.length} sub={L(`${closed} tasi yakunlangan`, `завершено: ${closed}`)} />
        <Stat label={L('Jami video', 'Всего видео')} value={tot.total} sub={L(`${tot.done} tasi tayyor`, `готово: ${tot.done}`)} />
        <Stat label={L('Jami to‘langan', 'Всего оплачено')} value={som(tot.paid)} sub={cur()} />
        <Stat label={L('Umumiy qoldiq', 'Общий остаток')} value={tot.price ? som(tot.left) : '—'} sub={tot.left ? L('to‘lanmagan', 'не оплачено') : L('qarz yo‘q', 'долга нет')} warn={tot.left > 0} />
      </div>
      <Card className="min-w-0">
        <CardHead title={L('Oylar bo‘yicha', 'По месяцам')} sub={L('qatorni bossangiz, o‘sha oy ochiladi', 'нажмите на строку, чтобы открыть месяц')} />
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[620px] text-[13.5px]">
            <thead><tr className="text-left text-[12px] text-muted">
              <th className="pb-2 font-medium">{L('Oy', 'Месяц')}</th><th className="pb-2 font-medium">{L('Holat', 'Статус')}</th><th className="pb-2 text-right font-medium">{L('Video', 'Видео')}</th><th className="pb-2 text-right font-medium">{L('Tayyor', 'Готово')}</th>
              <th className="pb-2 text-right font-medium">{L('Summa', 'Сумма')}</th><th className="pb-2 text-right font-medium">{L('To‘langan', 'Оплачено')}</th><th className="pb-2 text-right font-medium">{L('Qoldiq', 'Остаток')}</th><th className="pb-2" />
            </tr></thead>
            <tbody>
              {rows.map(({ p, s }) => (
                <tr key={p.id} className="cursor-pointer border-t border-line hover:bg-surface-2" onClick={() => pick(p.id)}>
                  <td className="py-2.5 font-semibold">{periodName(p.name)}</td>
                  <td>{p.closedAt ? <span className="inline-flex items-center gap-1 text-good-text"><Check size={13} strokeWidth={2.6} />{L('yakunlangan', 'завершён')}</span> : <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" />{L('joriy', 'текущий')}</span>}</td>
                  <td className="text-right tnum">{s.total}</td>
                  <td className="text-right tnum">{s.done}</td>
                  <td className="text-right tnum">{s.price ? som(s.price) : '—'}</td>
                  <td className="text-right tnum">{som(s.paid)}</td>
                  <td className={cn('text-right tnum', s.left > 0 && 'font-semibold text-critical-text')}>{s.price ? som(s.left) : '—'}</td>
                  <td className="text-right">
                    <Button size="icon-sm" variant="ghost" aria-label={`${p.name} Excel`} title={L('Shu oy Excel hisoboti', 'Отчёт Excel за этот месяц')} onClick={(e) => { e.stopPropagation(); downloadAuthed(`/narxtop/report.xlsx?period=${p.id}`, 'narxtop-report.xlsx').catch((x: Error) => alert(x.message)); }}><Download size={15} /></Button>
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line-2 font-semibold">
                <td className="py-2.5">{L('Jami', 'Итого')}</td><td /><td className="text-right tnum">{tot.total}</td><td className="text-right tnum">{tot.done}</td>
                <td className="text-right tnum">{tot.price ? som(tot.price) : '—'}</td><td className="text-right tnum">{som(tot.paid)}</td><td className="text-right tnum">{tot.price ? som(tot.left) : '—'}</td><td />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Stat({ label: title, value, sub, warn, children }: { label: string; value: ReactNode; sub: string; warn?: boolean; children?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-[12.5px] font-medium text-muted">{title}</div>
      <div className={cn('mt-1 font-display leading-tight font-semibold tracking-[-0.02em] whitespace-nowrap tnum', String(value).length > 8 ? 'text-[20px] sm:text-[22px]' : 'text-[26px]')}>{value}</div>
      <div className={cn('text-[12.5px] text-muted', warn && 'font-semibold text-critical-text')}>{sub}</div>
      {children}
    </Card>
  );
}

/** To'lovlar: ish beruvchi uchun eng muhim joy — oy summasi, to'langan, qoldiq va har bir to'lov (kim yozdi, tasdiqlandimi). */
function Payments({ period, pays, price, paid, left, pending, me }: { period: Period; pays: NarxtopData['payments']; price: number; paid: number; left: number; pending: number; me: MeInfo }) {
  const mut = useNarxtopMutation();
  const [adding, setAdding] = useState(false);
  const [editPrice, setEditPrice] = useState(false);
  const [amount, setAmount] = useState('');
  const admin = me.role === 'admin';
  const pct = price ? Math.min(1, paid / price) : 0;
  const fmtInput = (v: string) => { const d = v.replace(/\D/g, ''); return d ? som(Number(d)) : ''; };
  return (
    <Card>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Wallet size={19} className="text-accent-text" />
        <h2 className="card-title">{L('To‘lovlar', 'Оплаты')} · {periodName(period.name)}</h2>
        <Button variant="primary" className="ml-auto" onClick={() => { setAmount(''); mut.reset(); setAdding(true); }}><Plus size={16} />{L('To‘lov qo‘shish', 'Добавить оплату')}</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[16px] bg-surface-2 px-4 py-3">
          <div className="text-[12.5px] text-muted">{L('Oy uchun kelishilgan summa', 'Сумма за месяц')}</div>
          {editPrice ? (
            <form className="mt-1 flex gap-1" onSubmit={(e) => { e.preventDefault(); mut.mutate({ path: `/periods/${period.id}`, method: 'PATCH', body: { price: new FormData(e.currentTarget).get('price') } }); setEditPrice(false); }}>
              <input name="price" className="input h-9 min-w-0 flex-1 text-right" inputMode="numeric" defaultValue={price || ''} autoFocus />
              <Button size="icon" type="submit" variant="primary" aria-label={L('Saqlash', 'Сохранить')}><Check size={15} /></Button>
            </form>
          ) : (
            <button className="mt-0.5 font-display text-[22px] font-semibold tnum underline decoration-dotted decoration-1 underline-offset-[6px] hover:text-accent-text" title={L('O‘zgartirish', 'Изменить')} onClick={() => setEditPrice(true)}>
              {price ? `${som(price)}` : L('kiritish', 'указать')}
            </button>
          )}
        </div>
        <div className="rounded-[16px] bg-surface-2 px-4 py-3">
          <div className="text-[12.5px] text-muted">{L('To‘langan', 'Оплачено')}</div>
          <div className="mt-0.5 font-display text-[22px] font-semibold text-good-text tnum">{som(paid)}</div>
          {pending > 0 && <div className="text-[12px] text-muted">⏳ {L(`${som(pending)} tasdiq kutmoqda`, `${som(pending)} ждёт подтверждения`)}</div>}
        </div>
        <div className="rounded-[16px] bg-surface-2 px-4 py-3">
          <div className="text-[12.5px] text-muted">{L('Qoldiq', 'Осталось оплатить')}</div>
          <div className={cn('mt-0.5 font-display text-[22px] font-semibold tnum', left ? 'text-critical-text' : 'text-good-text')}>{price ? som(left) : '—'}</div>
          {price > 0 && !left && <div className="text-[12px] text-good-text">{L('to‘liq to‘langan ✓', 'оплачено полностью ✓')}</div>}
        </div>
      </div>
      {price > 0 && <Meter value={pct} className="mt-3" />}

      <div className="mt-4">
        {!pays.length ? <p className="text-[13px] text-muted">{L('Bu oyda hali to‘lov yozilmagan.', 'В этом месяце оплат пока нет.')}</p> : (
          <ul className="grid gap-1.5">
            {pays.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] border border-line px-3 py-2 text-[13.5px]">
                <span className="w-[78px] text-muted tnum">{dmy(p.paidAt)}</span>
                <b className="tnum">{som(p.amount)} {cur()}</b>
                <span className="min-w-0 flex-1 truncate text-muted" title={p.note}>{p.note}{p.createdBy ? ` · ${p.createdBy}` : ''}</span>
                {p.confirmedAt
                  ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-good-text"><Check size={13} strokeWidth={2.6} />{L('tasdiqlangan', 'подтверждено')}</span>
                  : admin
                    ? <Button size="sm" variant="primary" onClick={() => mut.mutate({ path: `/payments/${p.id}/confirm`, body: {} })}><Check size={13} />{L('Oldim', 'Получил')}</Button>
                    : <span className="text-[12px] text-muted">⏳ {L('Sardor tasdiqlashi kutilmoqda', 'ждёт подтверждения Сардора')}</span>}
                {(admin || !p.confirmedAt) && (
                  <button className="text-muted hover:text-critical-text" aria-label={L('To‘lovni o‘chirish', 'Удалить оплату')}
                    onClick={() => confirm(L(`${som(p.amount)} so‘mlik to‘lov o‘chirilsinmi?`, `Удалить оплату ${som(p.amount)} сум?`)) && mut.mutate({ path: `/payments/${p.id}`, method: 'DELETE' })}><Trash2 size={14} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title={`${L('To‘lov qo‘shish', 'Добавить оплату')} · ${periodName(period.name)}`}>
        <form className="grid gap-3.5" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          mut.mutate({ path: '/payments', body: { periodId: period.id, amount: amount.replace(/\D/g, ''), paidAt: fromYmd(String(fd.get('date'))), note: fd.get('note') } }, { onSuccess: () => setAdding(false) });
        }}>
          {!admin && <p className="rounded-xl bg-accent-wash px-3 py-2 text-[13px] text-accent-text">{L('Bergan summangizni yozing. Sardor pulni olganini tasdiqlaydi — sizga Telegram’da xabar keladi.', 'Укажите сумму, которую вы передали. Сардор подтвердит получение — вам придёт сообщение в Telegram.')}</p>}
          <Field label={L('Summa (so‘m)', 'Сумма (сум)')}>
            <input className="input h-12 text-[17px] font-semibold tnum" inputMode="numeric" placeholder="1 000 000" required autoFocus value={amount} onChange={(e) => setAmount(fmtInput(e.target.value))} />
          </Field>
          {left > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="rounded-full border border-line px-3 py-1.5 text-[13px] hover:bg-surface-2" onClick={() => setAmount(som(left))}>{L('Butun qoldiq', 'Весь остаток')}: {som(left)}</button>
              {left > 1_000_000 && <button type="button" className="rounded-full border border-line px-3 py-1.5 text-[13px] hover:bg-surface-2" onClick={() => setAmount(som(Math.round(left / 2 / 100_000) * 100_000))}>{L('Yarmi', 'Половина')}: {som(Math.round(left / 2 / 100_000) * 100_000)}</button>}
            </div>
          )}
          <Field label={L('Sana', 'Дата')}><input name="date" type="date" className="input h-11" defaultValue={ymd(Date.now())} /></Field>
          <Field label={L('Izoh (ixtiyoriy)', 'Комментарий (необязательно)')}><input name="note" className="input h-11" placeholder={L('masalan: avans, naqd, kartaga', 'например: аванс, наличными, на карту')} /></Field>
          {mut.error && <p className="text-[13px] text-critical-text">{mut.error.message}</p>}
          <Button type="submit" variant="primary" className="h-12 justify-center text-[15px]" disabled={mut.isPending || !amount}><Check size={16} />{L('Saqlash', 'Сохранить')}</Button>
        </form>
      </Modal>
    </Card>
  );
}

/** Tanlov: qiymat bazada o'zbekcha nom, ko'rinishi joriy tilda. */
function Choice({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const [custom, setCustom] = useState(false);
  if (custom) return <input className="input h-11" autoFocus placeholder={L('Yangi nom', 'Новое название')} onBlur={(e) => { onChange(e.target.value); setCustom(false); }} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), (e.target as HTMLInputElement).blur())} />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button type="button" key={o} onClick={() => onChange(value === o ? '' : o)} aria-pressed={value === o}
          className={cn('rounded-full border border-line px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink', value === o && 'border-transparent bg-accent font-semibold text-accent-ink hover:text-accent-ink')}>{nm(o)}</button>
      ))}
      <button type="button" onClick={() => setCustom(true)} className="rounded-full border border-dashed border-line-2 px-3 py-1.5 text-[13px] text-muted hover:text-ink">{L('+ boshqa', '+ другое')}</button>
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
    <Modal open={open} onClose={onClose} title={L('Yangi vazifa', 'Новая задача')} className="w-[min(640px,calc(100vw-32px))]">
      <form className="grid gap-4" onSubmit={submit}>
        <Field label={L('Vazifa nomi', 'Название задачи')}><input className="input h-12 text-[15px]" autoFocus required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={L('masalan: Qahramon va NARXTOP', 'например: Герой и NARXTOP')} /></Field>
        <div className="grid gap-1.5"><span className="text-xs font-medium text-ink-2">{L('Yo‘nalish', 'Направление')}</span><Choice options={d.directions} value={f.direction} onChange={(v) => setF({ ...f, direction: v })} /></div>
        <div className="grid gap-1.5"><span className="text-xs font-medium text-ink-2">{L('Uslub', 'Стиль')}</span><Choice options={d.styles} value={f.style} onChange={(v) => setF({ ...f, style: v })} /></div>
        <Field label={L('Muddat (ixtiyoriy)', 'Срок (необязательно)')} className="sm:w-56"><input type="date" className="input h-11" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
        {mut.error && <p className="text-[13px] text-critical-text">{mut.error.message}</p>}
        <Button type="submit" variant="primary" className="h-11 justify-center text-[15px]" disabled={mut.isPending || !f.title.trim()}><Plus size={17} />{L('Vazifani qo‘shish', 'Добавить задачу')}</Button>
        <p className="text-[12.5px] text-muted">{L('Ssenariy kerak bo‘lsa, vazifani ochib keyin qo‘shasiz yoki botga yuborasiz.', 'Сценарий можно добавить потом в карточке задачи или отправить боту.')}</p>
      </form>
    </Modal>
  );
}

function NewPeriod({ open, onClose, n, onCreated }: { open: boolean; onClose: () => void; n: number; onCreated: (id: number) => void }) {
  const mut = useNarxtopMutation();
  return (
    <Modal open={open} onClose={onClose} title={L('Yangi ish oyi', 'Новый рабочий месяц')}>
      <form className="grid gap-3.5" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        mut.mutate({ path: '/periods', body: { name: fd.get('name'), price: fd.get('price') || 0 } }, { onSuccess: (p) => { onCreated((p as Period).id); onClose(); } });
      }}>
        <p className="text-[13px] text-muted">{L('Yangi oy ochilgach, yangi vazifalar shu oyga yoziladi. Oldingi oy yakunlanadi, uning hisoboti saqlanib qoladi.', 'После открытия нового месяца задачи будут попадать в него. Предыдущий месяц завершится, его отчёт сохранится.')}</p>
        <Field label={L('Nomi', 'Название')}><input name="name" className="input h-11" defaultValue={`${n}-oy`} required autoFocus /></Field>
        <Field label={L('Oy uchun kelishilgan summa (so‘m)', 'Согласованная сумма за месяц (сум)')}><input name="price" className="input h-11" inputMode="numeric" placeholder="5 000 000" /></Field>
        {mut.error && <p className="text-[13px] text-critical-text">{mut.error.message}</p>}
        <Button type="submit" variant="primary" className="h-11 justify-center" disabled={mut.isPending}>{L('Oyni ochish', 'Открыть месяц')}</Button>
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
    if (me.role === 'client') return o.status === 'review' ? L('Videoni ko‘rib chiqing: hammasi to‘g‘ri bo‘lsa “Tayyor”, o‘zgartirish kerak bo‘lsa “Tuzatish” ni bosing va izoh yozing.', 'Проверьте видео: если всё верно — нажмите «Готово», если нужны изменения — «Правки» и напишите комментарий.') : null;
    return o.status === 'new' ? 'Boshlaganingizda “Ishlanmoqda” ni bosing.' : o.status === 'work' || o.status === 'fix' ? 'Video tayyor bo‘lsa, havolasini qo‘ying va “Tekshiruvda” ni bosing — ish beruvchiga xabar boradi.' : null;
  }, [me.role, o.status]);

  return (
    <Sheet open onClose={onClose} title={o.title} header={
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-muted">#{o.id} · {periodName(period?.name ?? '')} · {o.source === 'import' ? L('eski jadvaldan', 'из старой таблицы') : dmy(o.createdAt)} · {o.createdBy || '—'}{o.source === 'telegram' ? ' · Telegram' : ''}</div>
          <input className="mt-0.5 w-full bg-transparent font-display text-[19px] font-semibold tracking-[-0.02em] outline-none" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label={L('Vazifa nomi', 'Название задачи')} />
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label={L('Yopish', 'Закрыть')}>✕</Button>
      </div>
    }>
      <div className="grid gap-5 pt-3">
        <section className="grid gap-2">
          <span className="text-xs font-medium text-ink-2">{L('Holat', 'Статус')}</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((x) => (
              <button key={x.id} title={statusHint(x.id, lang())} onClick={() => patch({ status: x.id, ...(x.id === 'fix' && comment.trim() ? { comment } : {}) }, () => x.id === 'fix' && setComment(''))}
                className={cn('rounded-full border border-line px-3.5 py-2 text-[13.5px] font-medium text-ink-2 hover:text-ink', o.status === x.id && cn('border-transparent font-semibold', TONE[x.id]))}>
                {o.status === x.id && <Check size={14} className="mr-1 inline" />}{st(x.id)}
              </button>
            ))}
          </div>
          {nextHint && <p className="rounded-xl bg-accent-wash px-3 py-2 text-[13px] text-accent-text">{nextHint}</p>}
        </section>

        <div className="grid gap-1.5"><span className="text-xs font-medium text-ink-2">{L('Yo‘nalish', 'Направление')}</span><Choice options={d.directions} value={o.direction} onChange={(v) => patch({ direction: v })} /></div>
        <div className="grid gap-1.5"><span className="text-xs font-medium text-ink-2">{L('Uslub', 'Стиль')}</span><Choice options={d.styles} value={o.style} onChange={(v) => patch({ style: v })} /></div>

        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <Field label={L('Tayyor video havolasi', 'Ссылка на готовое видео')}>
            <div className="flex gap-1.5">
              <input className="input h-11 min-w-0 flex-1" value={f.videoUrl} onChange={(e) => setF({ ...f, videoUrl: e.target.value })} placeholder={L('Google Drive, Telegram yoki YouTube havolasi', 'Ссылка Google Drive, Telegram или YouTube')} />
              {o.videoUrl && <a className="grid size-11 shrink-0 place-items-center rounded-full border border-line hover:bg-surface-2" href={o.videoUrl} target="_blank" rel="noreferrer" aria-label={L('Ochish', 'Открыть')}><ExternalLink size={16} /></a>}
            </div>
          </Field>
          <Field label={L('Muddat', 'Срок')}><input type="date" className="input h-11" value={f.deadline} onChange={(e) => setF({ ...f, deadline: e.target.value })} /></Field>
        </div>

        <Field label={L('Ssenariy', 'Сценарий')}><textarea className="input min-h-[220px] py-2.5 text-[14px] leading-relaxed" value={f.script} onChange={(e) => setF({ ...f, script: e.target.value })} placeholder={L('Ssenariy matni…', 'Текст сценария…')} /></Field>
        {o.files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {o.files.map((x, i) => (
              <Button key={i} size="sm" onClick={() => downloadAuthed(`/narxtop/orders/${o.id}/file/${i}`, x.name).catch((e: Error) => alert(e.message))}><FileText size={14} />{x.name}</Button>
            ))}
          </div>
        )}
        <Field label={L('Izoh (Excel hisobotga ham chiqadi)', 'Примечание (попадает в отчёт Excel)')}><input className="input h-11" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>

        <div className={cn('sticky bottom-0 -mx-1 flex items-center gap-2 bg-surface px-1 py-2 transition-opacity', dirty ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          <Button variant="primary" onClick={save} disabled={mut.isPending}><Check size={16} />{L('O‘zgarishlarni saqlash', 'Сохранить изменения')}</Button>
          <Button variant="ghost" onClick={() => setF({ title: o.title, script: o.script, videoUrl: o.videoUrl, note: o.note, deadline: o.deadline ? ymd(o.deadline) : '' })}>{L('Bekor qilish', 'Отмена')}</Button>
        </div>
        {mut.error && <p className="text-[13px] text-critical-text">{mut.error.message}</p>}

        <section className="grid gap-2 border-t border-line pt-4">
          <span className="text-xs font-medium text-ink-2">{L('Izohlar va tarix', 'Комментарии и история')}</span>
          <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (comment.trim()) patch({ comment }, () => setComment('')); }}>
            <input className="input h-11 min-w-0 flex-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder={L('Izoh yozing (masalan, nimani tuzatish kerak)…', 'Напишите комментарий (например, что исправить)…')} />
            <Button type="submit" variant="dark" className="h-11" disabled={!comment.trim()}><MessageSquare size={15} />{L('Yuborish', 'Отправить')}</Button>
          </form>
          <ul className="grid gap-1.5">
            {[...o.log].reverse().map((l, i) => (
              <li key={i} className="flex gap-2 text-[13px]">
                <span className="w-[86px] shrink-0 text-muted tnum">{dmy(l.t)} {new Date(l.t + TZ).toISOString().slice(11, 16)}</span>
                <span><b className="font-medium">{l.who}</b> <span className="text-ink-2">{logLabel(l.text, lang())}</span></span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex justify-end border-t border-line pt-3">
          <Button variant="danger" onClick={() => confirm(L(`“${o.title}” vazifasi o‘chirilsinmi? Bu qaytarilmaydi.`, `Удалить задачу «${o.title}»? Это нельзя отменить.`)) && mut.mutate({ path: `/orders/${o.id}`, method: 'DELETE' }, { onSuccess: onClose })}>
            <Trash2 size={15} />{L('Vazifani o‘chirish', 'Удалить задачу')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
