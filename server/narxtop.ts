// Narxtop bo'limi API: vazifalar, ish oylari, to'lovlar, Excel hisobot va bot uchun kirish nuqtalari.
import ExcelJS from 'exceljs';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { DEFAULT_DIRECTIONS, DEFAULT_STYLES, STATUSES, label, som, normalizeDirection, normalizeStyle, statusLabel, statusName, summarize, titleFrom, tr, type Lang, type NarxtopData, type Order, type OrderStatus } from '../src/core/narxtop';
import { adminOnly, botUsername, tgNotify, type AuthUser, type Env } from './auth';
import { db } from './db';
import { orders, payments, periods, users, type OrderFile } from './schema';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STATUS_IDS = new Set(STATUSES.map((s) => s.id));
const PANEL = () => process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '';

export async function loadAll(): Promise<NarxtopData> {
  const [p, o, pay] = await Promise.all([
    db.select().from(periods).orderBy(periods.id),
    db.select().from(orders).orderBy(orders.id),
    db.select().from(payments).orderBy(payments.paidAt),
  ]);
  const used = (k: 'direction' | 'style') => o.map((x) => x[k]).filter(Boolean);
  const uniq = (a: string[]) => [...new Set(a)];
  const live = (o as Order[]).filter((x) => !x.deletedAt);
  return { periods: p, orders: live, archived: (o as Order[]).filter((x) => x.deletedAt), payments: pay, directions: uniq([...DEFAULT_DIRECTIONS, ...used('direction')]), styles: uniq([...DEFAULT_STYLES, ...used('style')]), bot: await botUsername() };
}

async function currentPeriodId(): Promise<number> {
  const [cur] = await db.select().from(periods).where(isNull(periods.closedAt)).orderBy(desc(periods.id)).limit(1);
  if (cur) return cur.id;
  const [last] = await db.select().from(periods).orderBy(desc(periods.id)).limit(1);
  if (last) return last.id;
  const [p] = await db.insert(periods).values({ name: '1-oy', price: 0, createdAt: Date.now() }).returning();
  return p.id;
}

/** Kimga xabar: mijoz harakat qilsa — adminlarga, admin harakat qilsa — mijozlarga. */
async function notifyOther(actor: AuthUser, text: (lang: Lang) => string, extra?: (lang: Lang) => object) {
  const all = await db.select().from(users);
  const targets = actor.role === 'client'
    ? [...all.filter((u) => u.role === 'admin').map((u) => ({ chatId: u.tgId, lang: u.lang })), { chatId: process.env.TELEGRAM_OWNER_ID, lang: 'uz' as Lang }]
    : all.filter((u) => u.role === 'client').map((u) => ({ chatId: u.tgId, lang: u.lang }));
  await tgNotify(targets.filter((t) => t.chatId && t.chatId !== actor.tgId), text, extra);
}

/** To'lov: ish beruvchi yozsa — Sardorga "✅ Oldim" tugmasi bilan xabar; Sardor yozsa — darhol tasdiqlangan. */
export async function createPayment(actor: AuthUser, b: { periodId?: number; amount?: unknown; paidAt?: number | null; note?: string }) {
  const amount = money(b.amount);
  if (!amount) throw new HTTPException(400, { message: 'Summani yozing' });
  const now = Date.now();
  const periodId = Number(b.periodId) || (await currentPeriodId());
  const [p] = await db.insert(payments).values({ periodId, amount, paidAt: b.paidAt === 0 ? 0 : Number(b.paidAt) || now, note: String(b.note ?? '').trim().slice(0, 200), createdBy: actor.name, confirmedAt: actor.role === 'admin' ? now : null }).returning();
  const [per] = await db.select().from(periods).where(eq(periods.id, periodId));
  const paid = (await db.select().from(payments).where(eq(payments.periodId, periodId))).reduce((s, x) => s + x.amount, 0);
  const left = per?.price ? Math.max(0, per.price - paid) : null;
  await notifyOther(actor, (l) => [`💰 <b>${tr(l, 'To‘lov yozildi', 'Записана оплата')}: ${som(amount)} ${tr(l, 'so‘m', 'сум')}</b>`, `${esc(per?.name ?? '')} · 👤 ${esc(actor.name)}${p.note ? ' · ' + esc(p.note) : ''}`,
    left !== null ? `${tr(l, 'Qoldiq', 'Остаток')}: ${som(left)} ${tr(l, 'so‘m', 'сум')}` : '', actor.role === 'client' ? tr(l, '\nPulni olgan bo‘lsangiz, tasdiqlang:', '') : ''].filter(Boolean).join('\n'),
  actor.role === 'client' ? (l) => ({ reply_markup: { inline_keyboard: [[{ text: tr(l, '✅ Oldim', '✅ Получил'), callback_data: `nx:pc:${p.id}` }]] } }) : undefined);
  return p;
}

export async function confirmPayment(actor: AuthUser, id: number) {
  const [p] = await db.select().from(payments).where(eq(payments.id, id));
  if (!p) throw new HTTPException(404, { message: 'To‘lov topilmadi' });
  if (p.confirmedAt) return p;
  const [n] = await db.update(payments).set({ confirmedAt: Date.now() }).where(eq(payments.id, id)).returning();
  await notifyOther(actor, (l) => `✅ <b>${tr(l, 'To‘lov tasdiqlandi', 'Оплата подтверждена')}:</b> ${som(p.amount)} ${tr(l, 'so‘m', 'сум')} · ${esc(actor.name)}`);
  return n;
}
const link = (o: { id: number }) => (PANEL() ? `\n${PANEL()}/#/narxtop?v=${o.id}` : '');

export async function createOrder(actor: AuthUser, b: Partial<Order> & { text?: string }, source: Order['source'] = 'panel', files: OrderFile[] = []) {
  const script = String(b.script ?? b.text ?? '').trim();
  const title = String(b.title ?? '').trim() || titleFrom(script || (files[0]?.name ?? ''));
  if (!title) throw new HTTPException(400, { message: 'Vazifa nomini yozing' });
  const periodId = b.periodId ? Number(b.periodId) : await currentPeriodId();
  const now = Date.now();
  const [o] = await db.insert(orders).values({
    periodId, title: title.slice(0, 200), script, direction: normalizeDirection(b.direction ?? ''), style: normalizeStyle(b.style ?? ''),
    status: source === 'import' && b.status && STATUS_IDS.has(b.status) ? b.status : 'new', deadline: b.deadline ?? null, videoUrl: String(b.videoUrl ?? ''), note: String(b.note ?? ''),
    createdAt: now, createdBy: actor.name, source, files, log: [{ t: now, who: actor.name, text: source === 'telegram' ? 'Telegram orqali yuborildi' : source === 'import' ? 'Google jadvaldan ko‘chirildi' : 'Vazifa qo‘shildi' }],
  }).returning();
  if (source !== 'import') await notifyOther(actor, (l) => `🆕 <b>${tr(l, 'Yangi vazifa', 'Новая задача')} #${o.id}</b>\n${esc(o.title)}\n👤 ${esc(actor.name)}${link(o)}`);
  return o as Order;
}

const FIELD_LOG: Partial<Record<keyof Order, string>> = { title: 'Nomi o‘zgardi', direction: 'Yo‘nalish', style: 'Uslub', script: 'Ssenariy yangilandi', videoUrl: 'Video havolasi', deadline: 'Muddat', periodId: 'Oy o‘zgardi' };

export async function updateOrder(actor: AuthUser, id: number, b: Partial<Order> & { comment?: string }) {
  const [o] = await db.select().from(orders).where(eq(orders.id, id));
  if (!o) throw new HTTPException(404, { message: 'Vazifa topilmadi' });
  const now = Date.now();
  const patch: Partial<typeof orders.$inferInsert> = {};
  const log = [...o.log];
  const str = (v: unknown) => String(v ?? '').trim();
  if (b.title !== undefined && str(b.title) && str(b.title) !== o.title) patch.title = str(b.title).slice(0, 200);
  if (b.direction !== undefined && normalizeDirection(str(b.direction)) !== o.direction) patch.direction = normalizeDirection(str(b.direction));
  if (b.style !== undefined && normalizeStyle(str(b.style)) !== o.style) patch.style = normalizeStyle(str(b.style));
  if (b.script !== undefined && str(b.script) !== o.script) patch.script = str(b.script);
  if (b.videoUrl !== undefined && str(b.videoUrl) !== o.videoUrl) patch.videoUrl = str(b.videoUrl);
  if (b.note !== undefined && str(b.note) !== o.note) patch.note = str(b.note);
  if (b.deadline !== undefined && (b.deadline ?? null) !== o.deadline) patch.deadline = b.deadline ?? null;
  if (b.periodId !== undefined && Number(b.periodId) !== o.periodId) patch.periodId = Number(b.periodId);
  for (const k of Object.keys(patch) as (keyof Order)[]) {
    const label = FIELD_LOG[k];
    if (!label) continue;
    const v = patch[k as keyof typeof patch];
    log.push({ t: now, who: actor.name, text: k === 'direction' || k === 'style' ? `${label}: ${v || '—'}` : label });
  }
  let statusChanged: OrderStatus | null = null;
  if (b.status && b.status !== o.status) {
    if (!STATUS_IDS.has(b.status)) throw new HTTPException(400, { message: 'Noma’lum holat' });
    patch.status = b.status;
    patch.doneAt = b.status === 'done' ? now : null;
    statusChanged = b.status;
    log.push({ t: now, who: actor.name, text: `Holat: ${statusName(o.status)} → ${statusName(b.status)}` });
  }
  const comment = str(b.comment);
  if (comment) log.push({ t: now, who: actor.name, text: `💬 ${comment}` });
  if (!Object.keys(patch).length && !comment) return o as Order;
  patch.log = log.slice(-60);
  const [n] = await db.update(orders).set(patch).where(eq(orders.id, id)).returning();
  const head = `#${n.id} ${esc(n.title)}`;
  const vid = n.videoUrl ? `\n🎬 ${esc(n.videoUrl)}` : '';
  if (statusChanged === 'review') await notifyOther(actor, (l) => `👀 <b>${tr(l, 'Tekshiring', 'Проверьте')}:</b> ${head}${vid}${link(n)}`);
  else if (statusChanged === 'done') await notifyOther(actor, (l) => `✅ <b>${tr(l, 'Tayyor', 'Готово')}:</b> ${head}${vid}`);
  else if (statusChanged === 'fix') await notifyOther(actor, (l) => `✏️ <b>${tr(l, 'Tuzatish kerak', 'Нужны правки')}:</b> ${head}${comment ? `\n💬 ${esc(comment)}` : ''}${link(n)}`);
  else if (statusChanged === 'work') await notifyOther(actor, (l) => `🛠 <b>${tr(l, 'Ish boshlandi', 'Работа начата')}:</b> ${head}`);
  else if (comment) await notifyOther(actor, () => `💬 <b>${esc(actor.name)}</b> · ${head}\n${esc(comment)}`);
  return n as Order;
}

const money = (v: unknown) => {
  const n = Math.round(Number(String(v ?? '').replace(/[^\d.-]/g, '')));
  if (!Number.isFinite(n) || n < 0) throw new HTTPException(400, { message: 'Summa noto‘g‘ri' });
  return n;
};

// ---------- Excel hisobot: ish beruvchining Google jadvali ko'rinishida (rangli yo'nalishlar, o'ngda yig'ma), tanlangan tilda ----------
const fmtD = (t: number | null) => (t ? new Date(t + 5 * 3600_000).toISOString().slice(0, 10).split('-').reverse().join('.') : '');

/** Yo'nalish ranglari — asl jadvaldagidek (fon, matn). */
const DIR_COLOR: Record<string, [string, string?]> = {
  Internet: ['CFE2F3'], NARXTOP: ['B4A7D6'], Serial: ['FF9900'], Novostroyka: ['F4CCCC'], Avtosalonlar: ['D9EAD3'],
  MFO: ['FFF2CC'], Banklar: ['FFFF00'], Reklama: ['7F6000', 'FFFFFF'], Hamkorlar: ['EA9999'], 'O‘quv video': ['B7B7B7'], Alohida: ['D9D9D9'],
};
const STATUS_COLOR: Record<OrderStatus, string> = { new: '9E9E9E', work: 'E69138', review: '3D85C6', fix: 'CC0000', done: '11734B' };
const HEAD = '76A5AF', HEAD2 = '45B4C6', NUM = 'D9D2E9';

export async function buildReport(periodId: number | 'all', lang: Lang = 'ru'): Promise<{ buf: Buffer; name: string }> {
  const d = await loadAll();
  const ps = periodId === 'all' ? d.periods : d.periods.filter((p) => p.id === periodId);
  if (!ps.length) throw new HTTPException(404, { message: 'Oy topilmadi' });
  const T = (uz: string, ru: string) => tr(lang, uz, ru);
  const pname = (n: string) => (lang === 'ru' ? n.replace(/^(\d+)-oy$/, '$1 месяц') : n);
  const cur = T('so‘m', 'сум');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PixelMind';
  const thin = { style: 'thin' as const, color: { argb: 'FF8C8C8C' } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const paint = (c: ExcelJS.Cell, bg: string, fg = '000000', bold = false) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + bg } };
    c.font = { name: 'Arial', size: 10, bold, color: { argb: 'FF' + fg } };
    c.border = box;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  };

  // 1-varaq: asl jadvalga o'xshash — har oy alohida blok, o'ngda yig'ma
  const ws = wb.addWorksheet(T('Umumiy', 'Общее'), { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 7 }, { width: 38 }, { width: 20 }, { width: 18 }, { width: 15 }, { width: 3 }, { width: 22 }, { width: 18 }];
  let row = 1;
  for (const p of ps) {
    const os = d.orders.filter((o) => o.periodId === p.id), pays = d.payments.filter((x) => x.periodId === p.id);
    const s = summarize(os, p, pays);
    const top = row;
    // sarlavha
    ws.mergeCells(row, 1, row, 5);
    paint(ws.getCell(row, 1), HEAD, 'FFFFFF', true);
    ws.getCell(row, 1).value = pname(p.name) + (p.closedAt ? T(' — yakunlangan', ' — завершён') : T(' — joriy', ' — текущий'));
    ws.getRow(row).height = 22;
    row++;
    const heads = [T('№', 'Кол-во'), T('Nomi', 'Название'), T('Yo‘nalish', 'Направление'), T('Uslub', 'Стилистика'), T('Holat', 'Статус')];
    heads.forEach((h, i) => { const c = ws.getCell(row, i + 1); paint(c, HEAD, '000000', true); c.value = h; });
    ws.getRow(row).height = 30;
    row++;
    os.forEach((o, i) => {
      const [bg, fg] = DIR_COLOR[o.direction] ?? ['FFFFFF'];
      const r = ws.getRow(row);
      const vals = [i + 1, o.title, label(o.direction, lang), label(o.style, lang), statusLabel(o.status, lang)];
      vals.forEach((v, j) => { const c = r.getCell(j + 1); paint(c, j === 0 ? NUM : bg, j === 0 ? '000000' : fg ?? '000000'); c.value = v; });
      // holat — asl jadvaldagi yashil "Готово" belgisi kabi
      paint(r.getCell(5), STATUS_COLOR[o.status], 'FFFFFF', true);
      r.height = o.title.length > 38 ? 30 : 18;
      row++;
    });
    if (!os.length) { ws.mergeCells(row, 1, row, 5); ws.getCell(row, 1).value = T('Vazifa yo‘q', 'Задач нет'); row++; }

    // o'ngda yig'ma: yo'nalishlar soni, tayyor, to'lov
    let sr = top;
    ws.mergeCells(sr, 7, sr, 8);
    paint(ws.getCell(sr, 7), HEAD2, '000000', true);
    ws.getCell(sr, 7).value = pname(p.name);
    sr++;
    for (const g of s.byDirection) {
      const [bg, fg] = DIR_COLOR[g.name] ?? ['FFFFFF'];
      paint(ws.getCell(sr, 7), bg, fg); ws.getCell(sr, 7).value = label(g.name, lang);
      paint(ws.getCell(sr, 8), bg, fg); ws.getCell(sr, 8).value = g.total;
      sr++;
    }
    for (const g of s.byStyle) {
      paint(ws.getCell(sr, 7), 'EFEFEF'); ws.getCell(sr, 7).value = label(g.name, lang);
      paint(ws.getCell(sr, 8), 'EFEFEF'); ws.getCell(sr, 8).value = g.total;
      sr++;
    }
    paint(ws.getCell(sr, 7), '6AA84F', 'FFFFFF', true); ws.getCell(sr, 7).value = T('Tayyor', 'Готово');
    paint(ws.getCell(sr, 8), '6AA84F', 'FFFFFF', true); ws.getCell(sr, 8).value = T(`${s.total} tadan ${s.done} ta`, `${s.done} видео из ${s.total}`);
    sr += 2;
    const money = (n: number) => `${som(n)} ${cur}`;
    const payRows: [string, string, string?][] = [
      [T('Oy summasi', 'Сумма за месяц'), s.price ? money(s.price) : '—'],
      [T('To‘langan', 'Оплачено'), money(s.paid), '6AA84F'],
      [T('Qoldiq', 'Остаток'), s.price ? money(s.left) : '—', s.left > 0 ? 'CC0000' : '6AA84F'],
    ];
    paint(ws.getCell(sr, 7), HEAD2, '000000', true); ws.mergeCells(sr, 7, sr, 8); ws.getCell(sr, 7).value = T('To‘lov', 'Оплата'); sr++;
    for (const [k, v, color] of payRows) {
      paint(ws.getCell(sr, 7), 'FFFFFF'); ws.getCell(sr, 7).value = k;
      paint(ws.getCell(sr, 8), color ?? 'FFFFFF', color ? 'FFFFFF' : '000000', true); ws.getCell(sr, 8).value = v;
      sr++;
    }
    row = Math.max(row, sr) + 2;
  }

  // 2-varaq: to'lovlar ro'yxati
  const pay = wb.addWorksheet(T('To‘lovlar', 'Оплата'), { views: [{ showGridLines: false, state: 'frozen', ySplit: 1 }] });
  pay.columns = [{ width: 14 }, { width: 12 }, { width: 16 }, { width: 34 }, { width: 18 }, { width: 16 }];
  [T('Oy', 'Месяц'), T('Sana', 'Дата'), T('Summa', 'Сумма') + ` (${cur})`, T('Izoh', 'Комментарий'), T('Kim yozdi', 'Кто записал'), T('Tasdiq', 'Подтверждено')]
    .forEach((h, i) => { const c = pay.getCell(1, i + 1); paint(c, HEAD, '000000', true); c.value = h; });
  let pr = 2;
  for (const p of ps) for (const x of d.payments.filter((y) => y.periodId === p.id)) {
    const vals = [pname(p.name), fmtD(x.paidAt) || '—', x.amount, x.note, x.createdBy, x.confirmedAt ? T('ha', 'да') : T('kutilmoqda', 'ожидает')];
    vals.forEach((v, j) => { const c = pay.getCell(pr, j + 1); paint(c, 'FFFFFF'); c.value = v; });
    pay.getCell(pr, 3).numFmt = '#,##0';
    paint(pay.getCell(pr, 6), x.confirmedAt ? 'D9EAD3' : 'FFF2CC');
    pr++;
  }

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const slug = periodId === 'all' ? T('hammasi', 'vse') : ps[0].name.replace(/[^\p{L}\p{N}-]+/gu, '_');
  return { buf, name: `narxtop-${T('hisobot', 'otchet')}-${slug}-${fmtD(Date.now()).split('.').reverse().join('-')}.xlsx` };
}

export const narxtop = new Hono<Env>()
  .get('/', async (c) => c.json(await loadAll()))
  .post('/orders', async (c) => {
    const b = await c.req.json<Partial<Order> & { source?: string }>();
    // source=import — eski jadvaldan ko'chirish (faqat admin): sana noma'lum, xabar yuborilmaydi
    return c.json(await createOrder(c.get('user'), b, b.source === 'import' && c.get('user').role === 'admin' ? 'import' : 'panel'), 201);
  })
  .patch('/orders/:id', async (c) => c.json(await updateOrder(c.get('user'), Number(c.req.param('id')), await c.req.json())))
  // O'chirish — arxivga olish: vazifa bazada qoladi va tiklanadi. Butunlay o'chirish (?hard=1) faqat admin uchun.
  .delete('/orders/:id', async (c) => {
    const u = c.get('user'), id = Number(c.req.param('id'));
    const [o] = await db.select().from(orders).where(eq(orders.id, id));
    if (!o) return c.json({ ok: true });
    if (c.req.query('hard') === '1') {
      if (u.role !== 'admin') throw new HTTPException(403, { message: 'Faqat admin uchun' });
      await db.delete(orders).where(eq(orders.id, id));
      return c.json({ ok: true });
    }
    const now = Date.now();
    await db.update(orders).set({ deletedAt: now, log: [...o.log, { t: now, who: u.name, text: 'Arxivga olindi' }].slice(-60) }).where(eq(orders.id, id));
    await notifyOther(u, (l) => `🗑 <b>${tr(l, 'Vazifa arxivga olindi', 'Задача перенесена в архив')}:</b> #${o.id} ${esc(o.title)}\n👤 ${esc(u.name)}`);
    return c.json({ ok: true });
  })
  .post('/orders/:id/restore', async (c) => {
    const u = c.get('user'), id = Number(c.req.param('id'));
    const [o] = await db.select().from(orders).where(eq(orders.id, id));
    if (!o) throw new HTTPException(404, { message: 'Vazifa topilmadi' });
    const now = Date.now();
    await db.update(orders).set({ deletedAt: null, log: [...o.log, { t: now, who: u.name, text: 'Arxivdan tiklandi' }].slice(-60) }).where(eq(orders.id, id));
    return c.json({ ok: true });
  })
  // Zaxira nusxa: oylar, vazifalar (arxiv bilan), to'lovlar va foydalanuvchilar ro'yxati (parolsiz). Faqat admin.
  .get('/backup.json', adminOnly, async (c) => {
    const [p, o, pay, us] = await Promise.all([db.select().from(periods).orderBy(periods.id), db.select().from(orders).orderBy(orders.id), db.select().from(payments).orderBy(payments.id), db.select().from(users)]);
    const body = { kind: 'narxtop-backup', version: 1, exportedAt: Date.now(), periods: p, orders: o, payments: pay, users: us.map((x) => ({ login: x.login, name: x.name, role: x.role, lang: x.lang })) };
    return c.body(JSON.stringify(body, null, 1), 200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="narxtop-zaxira-${new Date().toISOString().slice(0, 10)}.json"` });
  })
  // Zaxiradan tiklash: hozirgi oylar, vazifalar va to'lovlar fayldagilar bilan almashtiriladi (foydalanuvchilarga tegilmaydi). Faqat admin.
  .post('/restore', adminOnly, async (c) => {
    const b = await c.req.json<{ kind?: string; periods?: (typeof periods.$inferInsert)[]; orders?: (typeof orders.$inferInsert)[]; payments?: (typeof payments.$inferInsert)[] }>();
    if (b.kind !== 'narxtop-backup' || !Array.isArray(b.periods) || !Array.isArray(b.orders) || !Array.isArray(b.payments)) throw new HTTPException(400, { message: 'Zaxira fayli noto‘g‘ri' });
    await db.transaction(async (tx) => {
      await tx.delete(payments); await tx.delete(orders); await tx.delete(periods);
      for (let i = 0; i < b.periods!.length; i += 50) await tx.insert(periods).values(b.periods!.slice(i, i + 50));
      for (let i = 0; i < b.orders!.length; i += 50) await tx.insert(orders).values(b.orders!.slice(i, i + 50));
      for (let i = 0; i < b.payments!.length; i += 50) await tx.insert(payments).values(b.payments!.slice(i, i + 50));
    });
    return c.json({ ok: true, periods: b.periods.length, orders: b.orders.length, payments: b.payments.length });
  })
  /** Telegram orqali kelgan fayl (ssenariy .docx/.pdf): bot API dan olib beriladi. */
  .get('/orders/:id/file/:idx', async (c) => {
    const [o] = await db.select().from(orders).where(eq(orders.id, Number(c.req.param('id'))));
    const f = o?.files[Number(c.req.param('idx'))];
    const t = process.env.TELEGRAM_BOT_TOKEN;
    if (!f || !t) throw new HTTPException(404, { message: 'Fayl topilmadi' });
    const info = await (await fetch(`https://api.telegram.org/bot${t}/getFile?file_id=${encodeURIComponent(f.fileId)}`)).json() as { ok: boolean; result?: { file_path: string } };
    if (!info.ok) throw new HTTPException(404, { message: 'Telegram faylni bermadi (20 MB dan katta bo‘lishi mumkin)' });
    const r = await fetch(`https://api.telegram.org/file/bot${t}/${info.result!.file_path}`);
    return c.body(new Uint8Array(await r.arrayBuffer()), 200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}` });
  })
  .post('/periods', async (c) => {
    const b = await c.req.json<{ name?: string; price?: unknown }>();
    const name = String(b.name ?? '').trim();
    if (!name) throw new HTTPException(400, { message: 'Oy nomini yozing' });
    const now = Date.now();
    const [p] = await db.insert(periods).values({ name, price: money(b.price ?? 0), createdAt: now }).returning();
    await db.update(periods).set({ closedAt: now }).where(and(ne(periods.id, p.id), isNull(periods.closedAt)));
    return c.json(p, 201);
  })
  .patch('/periods/:id', async (c) => {
    const b = await c.req.json<{ name?: string; price?: unknown; closed?: boolean }>();
    const patch: Partial<typeof periods.$inferInsert> = {};
    if (b.closed !== undefined) patch.closedAt = b.closed ? Date.now() : null;
    if (b.name?.trim()) patch.name = b.name.trim();
    if (b.price !== undefined) patch.price = money(b.price);
    if (Object.keys(patch).length) await db.update(periods).set(patch).where(eq(periods.id, Number(c.req.param('id'))));
    return c.json({ ok: true });
  })
  .delete('/periods/:id', adminOnly, async (c) => { await db.delete(periods).where(eq(periods.id, Number(c.req.param('id')))); return c.json({ ok: true }); })
  .post('/payments', async (c) => c.json(await createPayment(c.get('user'), await c.req.json()), 201))
  .post('/payments/:id/confirm', adminOnly, async (c) => c.json(await confirmPayment(c.get('user'), Number(c.req.param('id')))))
  // mijoz faqat o'zi yozgan va hali tasdiqlanmagan to'lovni o'chira oladi
  .delete('/payments/:id', async (c) => {
    const u = c.get('user');
    const [p] = await db.select().from(payments).where(eq(payments.id, Number(c.req.param('id'))));
    if (!p) return c.json({ ok: true });
    if (u.role !== 'admin' && p.confirmedAt) throw new HTTPException(403, { message: 'Tasdiqlangan to‘lovni faqat Sardor o‘chira oladi' });
    await db.delete(payments).where(eq(payments.id, p.id));
    return c.json({ ok: true });
  })
  .get('/report.xlsx', async (c) => {
    const q = c.req.query('period');
    const lang: Lang = c.req.query('lang') === 'uz' ? 'uz' : c.req.query('lang') === 'ru' ? 'ru' : c.get('user').lang;
    const { buf, name } = await buildReport(q === 'all' ? 'all' : Number(q) || (await currentPeriodId()), lang);
    return c.body(new Uint8Array(buf), 200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}` });
  })
  // ---------- bot uchun (worker ADMIN_TOKEN bilan, Telegram foydalanuvchisi nomidan) ----------
  .post('/tg/order', adminOnly, async (c) => {
    const b = await c.req.json<{ tgId: string; text?: string; files?: OrderFile[]; title?: string }>();
    const [u] = await db.select().from(users).where(eq(users.tgId, String(b.tgId)));
    const owner = String(b.tgId) === process.env.TELEGRAM_OWNER_ID;
    if (!u && !owner) throw new HTTPException(403, { message: 'Telegram ulanmagan' });
    const actor: AuthUser = u ? { id: u.id, login: u.login, name: u.name, role: u.role, tgId: u.tgId, lang: u.lang, via: 'session' } : c.get('user');
    return c.json(await createOrder(actor, { text: b.text, title: b.title }, 'telegram', b.files ?? []), 201);
  })
  .post('/tg/payment', adminOnly, async (c) => {
    const b = await c.req.json<{ tgId: string; amount: number; note?: string }>();
    const [u] = await db.select().from(users).where(eq(users.tgId, String(b.tgId)));
    const owner = String(b.tgId) === process.env.TELEGRAM_OWNER_ID;
    if (!u && !owner) throw new HTTPException(403, { message: 'Telegram ulanmagan' });
    const actor: AuthUser = u ? { id: u.id, login: u.login, name: u.name, role: u.role, tgId: u.tgId, lang: u.lang, via: 'session' } : c.get('user');
    return c.json(await createPayment(actor, { amount: b.amount, note: b.note }), 201);
  })
  .post('/tg/payment/:id/confirm', adminOnly, async (c) => {
    const b = await c.req.json<{ tgId: string }>();
    const [u] = await db.select().from(users).where(eq(users.tgId, String(b.tgId)));
    if (u && u.role !== 'admin') throw new HTTPException(403, { message: 'Faqat Sardor tasdiqlaydi' });
    if (!u && String(b.tgId) !== process.env.TELEGRAM_OWNER_ID) throw new HTTPException(403, { message: 'Telegram ulanmagan' });
    const actor: AuthUser = u ? { id: u.id, login: u.login, name: u.name, role: u.role, tgId: u.tgId, lang: u.lang, via: 'session' } : c.get('user');
    return c.json(await confirmPayment(actor, Number(c.req.param('id'))));
  })
  .post('/tg/order/:id', adminOnly, async (c) => {
    const b = await c.req.json<{ tgId: string; direction?: string; style?: string; status?: OrderStatus }>();
    const [u] = await db.select().from(users).where(eq(users.tgId, String(b.tgId)));
    const actor: AuthUser = u ? { id: u.id, login: u.login, name: u.name, role: u.role, tgId: u.tgId, lang: u.lang, via: 'session' } : c.get('user');
    const { tgId: _t, ...patch } = b;
    return c.json(await updateOrder(actor, Number(c.req.param('id')), patch));
  });
