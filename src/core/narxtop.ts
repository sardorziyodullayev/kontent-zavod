// Narxtop bo'limi: vazifa holatlari, nomlar va hisobot hisoblari (toza funksiyalar — panel, server va bot uchun umumiy).

export type OrderStatus = 'new' | 'work' | 'review' | 'fix' | 'done';
export type Role = 'admin' | 'client';

export interface Me { id: number; login: string; name: string; role: Role; tgLinked: boolean }
export interface Period { id: number; name: string; price: number; createdAt: number }
export interface Payment { id: number; periodId: number; amount: number; paidAt: number; note: string }
export interface OrderLog { t: number; who: string; text: string }
export interface Order {
  id: number; periodId: number; title: string; direction: string; style: string; status: OrderStatus;
  script: string; videoUrl: string; note: string; deadline: number | null; createdAt: number; doneAt: number | null;
  createdBy: string; source: 'panel' | 'telegram' | 'import'; files: { name: string; fileId: string }[]; log: OrderLog[];
}
export interface NarxtopData { periods: Period[]; orders: Order[]; payments: Payment[]; directions: string[]; styles: string[]; bot: string | null }

/** Holatlar ish tartibida. ru — Excel hisobot uchun (boshliqlar ruscha jadval ko'rib o'rgangan). */
export const STATUSES: { id: OrderStatus; name: string; ru: string; hint: string }[] = [
  { id: 'new', name: 'Yangi', ru: 'Новое', hint: 'Ssenariy keldi, hali boshlanmagan' },
  { id: 'work', name: 'Ishlanmoqda', ru: 'В работе', hint: 'Video tayyorlanmoqda' },
  { id: 'review', name: 'Tekshiruvda', ru: 'На проверке', hint: 'Video yuborildi, javob kutilmoqda' },
  { id: 'fix', name: 'Tuzatish', ru: 'Правки', hint: 'Tuzatish so‘raldi' },
  { id: 'done', name: 'Tayyor', ru: 'Готово', hint: 'Qabul qilindi' },
];
export const statusName = (s: OrderStatus) => STATUSES.find((x) => x.id === s)?.name ?? s;
export const statusRu = (s: OrderStatus) => STATUSES.find((x) => x.id === s)?.ru ?? s;

/** Jadvaldagi mavjud yo'nalishlar (bir xil yozilsin: "Аавтосалоны"/"Автосалон" → "Avtosalonlar"). */
export const DEFAULT_DIRECTIONS = ['NARXTOP', 'Internet', 'Novostroyka', 'Avtosalonlar', 'MFO', 'Banklar', 'Serial', 'Reklama', 'Hamkorlar', 'O‘quv video', 'Alohida'];
export const DEFAULT_STYLES = ['Multfilm', 'Real', 'Moushn'];

/** Erkin yozilgan yo'nalishni ro'yxatdagisiga moslaydi (katta-kichik harf, ortiqcha bo'sh joy, ruscha nomlar). */
export function normalizeDirection(raw: string, known: string[] = DEFAULT_DIRECTIONS): string {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const k = s.toLowerCase();
  const ALIAS: [RegExp, string][] = [
    [/нархтоп|narxtop/, 'NARXTOP'], [/интер|inter/, 'Internet'], [/новостр|недвиж|novostr|ko‘chmas|uy/, 'Novostroyka'],
    [/авто|avto/, 'Avtosalonlar'], [/мфо|mfo/, 'MFO'], [/банк|bank/, 'Banklar'], [/сериал|serial/, 'Serial'],
    [/реклам|reklam/, 'Reklama'], [/партн|парн|hamkor/, 'Hamkorlar'], [/обуч|o‘quv|oquv/, 'O‘quv video'], [/отдель|alohida/, 'Alohida'],
  ];
  const hit = known.find((d) => d.toLowerCase() === k);
  if (hit) return hit;
  for (const [re, name] of ALIAS) if (re.test(k)) return name;
  return s[0].toUpperCase() + s.slice(1);
}
export function normalizeStyle(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (!k) return '';
  if (/мульт|mult/.test(k)) return 'Multfilm';
  if (/реал|real/.test(k)) return 'Real';
  if (/моушн|motion|moushn/.test(k)) return 'Moushn';
  return raw.trim();
}

/** Ssenariy matnidan sarlavha: birinchi mazmunli qator, 80 belgigacha. */
export function titleFrom(text: string): string {
  const line = text.split('\n').map((l) => l.replace(/[*_#>`]/g, '').trim()).find((l) => l.length > 1) ?? 'Yangi vazifa';
  return line.length > 80 ? line.slice(0, 78).trimEnd() + '…' : line;
}

export interface Summary {
  total: number; done: number; open: number; byStatus: Record<OrderStatus, number>;
  byDirection: { name: string; total: number; done: number }[]; byStyle: { name: string; total: number; done: number }[];
  price: number; paid: number; left: number;
}

export function summarize(orders: Order[], period: Period | undefined, payments: Payment[]): Summary {
  const byStatus = { new: 0, work: 0, review: 0, fix: 0, done: 0 } as Record<OrderStatus, number>;
  for (const o of orders) byStatus[o.status]++;
  const group = (key: (o: Order) => string) => {
    const m = new Map<string, { name: string; total: number; done: number }>();
    for (const o of orders) {
      const name = key(o) || 'Ko‘rsatilmagan';
      const g = m.get(name) ?? { name, total: 0, done: 0 };
      g.total++;
      if (o.status === 'done') g.done++;
      m.set(name, g);
    }
    return [...m.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  };
  const price = period?.price ?? 0;
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  return { total: orders.length, done: byStatus.done, open: orders.length - byStatus.done, byStatus, byDirection: group((o) => o.direction), byStyle: group((o) => o.style), price, paid, left: Math.max(0, price - paid) };
}

/** 5000000 → "5 000 000" */
export const som = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');

// ---------- Telegram bot matnlari ----------
const escH = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const NX_HELP = ['🎬 <b>Narxtop vazifalari</b>', '',
  '• Ssenariyni shu yerga yuboring (matn yoki fayl) — panelda vazifa bo‘lib tushadi.',
  '• /vazifalar — bajarilmagan vazifalar va holati',
  '• /excel — joriy oy hisoboti (Excel fayl)',
  '', 'Video tayyor bo‘lsa yoki tekshirish kerak bo‘lsa, bot o‘zi xabar beradi.'].join('\n');

export const linkedText = (name: string) => `✅ <b>Ulandi: ${escH(name)}</b>\n\n${NX_HELP}`;
export const LINK_FAILED = '❌ Havola eskirgan yoki noto‘g‘ri. Paneldagi “Telegram’ni ulash” tugmasini qayta bosing.';

/** /vazifalar: joriy oydagi bajarilmagan vazifalar, holat bo'yicha guruhlab. */
export function openTasksText(d: NarxtopData, panelUrl = ''): string {
  const p = d.periods[d.periods.length - 1];
  if (!p) return 'Hali vazifa yo‘q.';
  const os = d.orders.filter((o) => o.periodId === p.id);
  const num = new Map(os.map((o, i) => [o.id, i + 1]));
  const s = summarize(os, p, d.payments.filter((x) => x.periodId === p.id));
  const L = [`📋 <b>${escH(p.name)}</b>: ${s.total} ta vazifa, ${s.done} tasi tayyor`];
  for (const st of STATUSES.filter((x) => x.id !== 'done')) {
    const list = os.filter((o) => o.status === st.id);
    if (!list.length) continue;
    L.push('', `<b>${st.name}</b> (${list.length})`);
    for (const o of list.slice(0, 15)) L.push(`${num.get(o.id)}. ${escH(o.title)}${o.direction ? ` · ${escH(o.direction)}` : ''}`);
    if (list.length > 15) L.push(`… yana ${list.length - 15} ta`);
  }
  if (s.open === 0) L.push('', 'Hammasi tayyor ✅');
  if (panelUrl) L.push('', `Panel: ${panelUrl}/#/narxtop`);
  return L.join('\n');
}

export const createdText = (o: Pick<Order, 'id' | 'title' | 'direction' | 'style'>, step: 'direction' | 'style' | 'done') =>
  [`✅ <b>Vazifa qo‘shildi</b> (#${o.id})`, escH(o.title), o.direction ? `Yo‘nalish: ${escH(o.direction)}` : '', o.style ? `Uslub: ${escH(o.style)}` : '',
    step === 'direction' ? '\nYo‘nalishni tanlang:' : step === 'style' ? '\nUslubni tanlang:' : ''].filter(Boolean).join('\n');

/** Tanlov tugmalari: 3 tadan qatorda. callback_data: nx:<d|s>:<orderId>:<index> */
export function choiceKeyboard(kind: 'd' | 's', orderId: number, options: string[]) {
  const btns = options.map((name, i) => ({ text: name, callback_data: `nx:${kind}:${orderId}:${i}` }));
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < btns.length; i += 3) rows.push(btns.slice(i, i + 3));
  rows.push([{ text: 'O‘tkazib yuborish', callback_data: `nx:${kind}:${orderId}:-1` }]);
  return { inline_keyboard: rows };
}
