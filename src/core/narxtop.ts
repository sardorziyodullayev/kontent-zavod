// Narxtop bo'limi: vazifa holatlari, nomlar va hisobot hisoblari (toza funksiyalar — panel, server va bot uchun umumiy).

export type OrderStatus = 'new' | 'work' | 'review' | 'fix' | 'done';
export type Role = 'admin' | 'client';

export interface Me { id: number; login: string; name: string; role: Role; tgLinked: boolean; lang: Lang }
export interface Period { id: number; name: string; price: number; createdAt: number; closedAt: number | null }
export interface Payment { id: number; periodId: number; amount: number; paidAt: number; note: string; createdBy: string; confirmedAt: number | null }
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
  /** yozilgan, lekin Sardor hali tasdiqlamagan summa (paid ichida) */
  pending: number;
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
  const pending = payments.filter((p) => !p.confirmedAt).reduce((s, p) => s + p.amount, 0);
  return { pending, total: orders.length, done: byStatus.done, open: orders.length - byStatus.done, byStatus, byDirection: group((o) => o.direction), byStyle: group((o) => o.style), price, paid, left: Math.max(0, price - paid) };
}

/** 5000000 → "5 000 000" */
export const som = (n: number) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');

// ---------- til: o'zbek / rus (ish beruvchi rus tilida ishlaydi) ----------
export type Lang = 'uz' | 'ru';
export const tr = (lang: Lang, uz: string, ru: string) => (lang === 'ru' ? ru : uz);

/** Bazada nomlar o'zbekcha saqlanadi; rus tilida ko'rsatish uchun tarjima (Excel hisobot ham shu nomlarni oladi). */
const NAME_RU: Record<string, string> = {
  NARXTOP: 'NARXTOP', Internet: 'Интернет', Novostroyka: 'Новостройки', Avtosalonlar: 'Автосалоны', MFO: 'МФО', Banklar: 'Банки',
  Serial: 'Сериал', Reklama: 'Реклама', Hamkorlar: 'Партнёры', 'O‘quv video': 'Обучающие', Alohida: 'Отдельно',
  Multfilm: 'Мультик', Real: 'Реал', Moushn: 'Моушн', 'Ko‘rsatilmagan': 'Не указано',
};
export const label = (name: string, lang: Lang) => (lang === 'ru' ? NAME_RU[name] ?? name : name);
export const statusLabel = (s: OrderStatus, lang: Lang) => (lang === 'ru' ? statusRu(s) : statusName(s));
const HINT_RU: Record<OrderStatus, string> = { new: 'Сценарий получен, работа не начата', work: 'Видео в работе', review: 'Видео отправлено, ждём ответа', fix: 'Запрошены правки', done: 'Принято' };
export const statusHint = (s: OrderStatus, lang: Lang) => (lang === 'ru' ? HINT_RU[s] : STATUSES.find((x) => x.id === s)?.hint ?? '');

/** Tarixdagi yozuvlar bazada o'zbekcha: rus tilida ko'rsatishda tarjima qilinadi. */
export function logLabel(text: string, lang: Lang): string {
  if (lang !== 'ru') return text;
  const FIX: [string, string][] = [['Vazifa qo‘shildi', 'Задача добавлена'], ['Telegram orqali yuborildi', 'Отправлено через Telegram'], ['Google jadvaldan ko‘chirildi', 'Перенесено из Google-таблицы'],
    ['Nomi o‘zgardi', 'Изменено название'], ['Ssenariy yangilandi', 'Сценарий обновлён'], ['Video havolasi', 'Ссылка на видео'], ['Muddat', 'Срок'], ['Oy o‘zgardi', 'Изменён месяц']];
  for (const [uz, ru] of FIX) if (text === uz) return ru;
  if (text.startsWith('Holat: ')) {
    let t = 'Статус: ' + text.slice(7);
    for (const st of STATUSES) t = t.replaceAll(st.name, st.ru);
    return t;
  }
  if (text.startsWith('Yo‘nalish: ')) return 'Направление: ' + label(text.slice(11), 'ru');
  if (text.startsWith('Uslub: ')) return 'Стиль: ' + label(text.slice(7), 'ru');
  return text;
}

// ---------- Telegram bot matnlari ----------
const escH = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const nxHelp = (lang: Lang) => lang === 'ru'
  ? ['🎬 <b>Задачи NARXTOP</b>', '', '• Отправьте сюда сценарий (текст или файл) — в панели появится задача.', '• /vazifalar — невыполненные задачи и их статус', '• /excel — отчёт за текущий месяц (Excel)', '• /tolov — оплаты: сколько оплачено, остаток и кнопка «Добавить оплату»', '', 'Когда видео готово или его нужно проверить, бот напишет сам.'].join('\n')
  : ['🎬 <b>Narxtop vazifalari</b>', '', '• Ssenariyni shu yerga yuboring (matn yoki fayl) — panelda vazifa bo‘lib tushadi.', '• /vazifalar — bajarilmagan vazifalar va holati', '• /excel — joriy oy hisoboti (Excel fayl)', '• /tolov — to‘lovlar: to‘langan, qoldiq va “To‘lov qo‘shish” tugmasi', '', 'Video tayyor bo‘lsa yoki tekshirish kerak bo‘lsa, bot o‘zi xabar beradi.'].join('\n');

export const linkedText = (name: string, lang: Lang) => `✅ <b>${tr(lang, 'Ulandi', 'Подключено')}: ${escH(name)}</b>\n\n${nxHelp(lang)}`;
export const linkFailed = (lang: Lang) => tr(lang, '❌ Havola eskirgan yoki noto‘g‘ri. Paneldagi “Telegram’ni ulash” tugmasini qayta bosing.', '❌ Ссылка устарела или неверна. Нажмите «Подключить Telegram» в панели ещё раз.');

/** /vazifalar: joriy oydagi bajarilmagan vazifalar, holat bo'yicha guruhlab. */
export function openTasksText(d: NarxtopData, panelUrl = '', lang: Lang = 'uz'): string {
  const p = [...d.periods].reverse().find((x) => !x.closedAt) ?? d.periods[d.periods.length - 1];
  if (!p) return tr(lang, 'Hali vazifa yo‘q.', 'Задач пока нет.');
  const os = d.orders.filter((o) => o.periodId === p.id);
  const num = new Map(os.map((o, i) => [o.id, i + 1]));
  const s = summarize(os, p, d.payments.filter((x) => x.periodId === p.id));
  const L = [`📋 <b>${escH(p.name)}</b>: ${tr(lang, `${s.total} ta vazifa, ${s.done} tasi tayyor`, `задач: ${s.total}, готово: ${s.done}`)}`];
  for (const st of STATUSES.filter((x) => x.id !== 'done')) {
    const list = os.filter((o) => o.status === st.id);
    if (!list.length) continue;
    L.push('', `<b>${statusLabel(st.id, lang)}</b> (${list.length})`);
    for (const o of list.slice(0, 15)) L.push(`${num.get(o.id)}. ${escH(o.title)}${o.direction ? ` · ${escH(label(o.direction, lang))}` : ''}`);
    if (list.length > 15) L.push(tr(lang, `… yana ${list.length - 15} ta`, `… ещё ${list.length - 15}`));
  }
  if (s.open === 0) L.push('', tr(lang, 'Hammasi tayyor ✅', 'Всё готово ✅'));
  if (panelUrl) L.push('', `${tr(lang, 'Panel', 'Панель')}: ${panelUrl}/#/narxtop`);
  return L.join('\n');
}

export const createdText = (o: Pick<Order, 'id' | 'title' | 'direction' | 'style'>, step: 'direction' | 'style' | 'done', lang: Lang = 'uz') =>
  [`✅ <b>${tr(lang, 'Vazifa qo‘shildi', 'Задача добавлена')}</b> (#${o.id})`, escH(o.title),
    o.direction ? `${tr(lang, 'Yo‘nalish', 'Направление')}: ${escH(label(o.direction, lang))}` : '', o.style ? `${tr(lang, 'Uslub', 'Стиль')}: ${escH(label(o.style, lang))}` : '',
    step === 'direction' ? tr(lang, '\nYo‘nalishni tanlang:', '\nВыберите направление:') : step === 'style' ? tr(lang, '\nUslubni tanlang:', '\nВыберите стиль:') : ''].filter(Boolean).join('\n');

/** Tanlov tugmalari: 3 tadan qatorda. callback_data: nx:<d|s>:<orderId>:<index> */
export function choiceKeyboard(kind: 'd' | 's', orderId: number, options: string[], lang: Lang = 'uz') {
  const btns = options.map((name, i) => ({ text: label(name, lang), callback_data: `nx:${kind}:${orderId}:${i}` }));
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < btns.length; i += 3) rows.push(btns.slice(i, i + 3));
  rows.push([{ text: tr(lang, 'O‘tkazib yuborish', 'Пропустить'), callback_data: `nx:${kind}:${orderId}:-1` }]);
  return { inline_keyboard: rows };
}

// ---------- to'lovlar ----------
/** Matndagi summa: "1 000 000", "1.5 mln", "1,5 млн", "500 ming", "500к". Topilmasa null. Qolgan matn — izoh. */
export function parseAmount(text: string): { amount: number; note: string } | null {
  const m = /(\d[\d\s.,]*)\s*(mln|million|млн|миллион\w*|ming|тыс\w*|k|к)?/i.exec(text.trim());
  if (!m) return null;
  const unit = (m[2] ?? '').toLowerCase();
  const raw = m[1].trim();
  let n: number;
  if (unit) n = Number(raw.replace(/\s/g, '').replace(',', '.')) * (/^(mln|million|млн|миллион)/.test(unit) ? 1e6 : 1e3);
  else n = Number(raw.replace(/[\s.,]/g, ''));
  if (!Number.isFinite(n) || n < 1000) return null;
  const note = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim().replace(/^[-–—:,]\s*/, '');
  return { amount: Math.round(n), note };
}

const fmtDay = (t: number) => (t ? new Date(t + 5 * 3600_000).toISOString().slice(0, 10).split('-').reverse().join('.') : '—');

/** Bot: joriy oy to'lovlari — summa, to'langan, qoldiq va ro'yxat. */
export function payText(d: NarxtopData, lang: Lang = 'uz'): string {
  const p = [...d.periods].reverse().find((x) => !x.closedAt) ?? d.periods[d.periods.length - 1];
  if (!p) return tr(lang, 'Hali oy ochilmagan.', 'Месяц ещё не открыт.');
  const pays = d.payments.filter((x) => x.periodId === p.id);
  const s = summarize([], p, pays);
  const cur = tr(lang, 'so‘m', 'сум');
  const L = [`💰 <b>${escH(p.name)} — ${tr(lang, 'to‘lovlar', 'оплаты')}</b>`, '',
    `${tr(lang, 'Oy summasi', 'Сумма за месяц')}: <b>${s.price ? som(s.price) + ' ' + cur : tr(lang, 'kiritilmagan', 'не указана')}</b>`,
    `${tr(lang, 'To‘langan', 'Оплачено')}: <b>${som(s.paid)} ${cur}</b>`,
    s.price ? `${tr(lang, 'Qoldiq', 'Остаток')}: <b>${som(s.left)} ${cur}</b>` : ''];
  if (s.pending) L.push(`⏳ ${tr(lang, 'Tasdiq kutilmoqda', 'Ожидает подтверждения')}: ${som(s.pending)} ${cur}`);
  if (pays.length) L.push('');
  for (const x of pays) L.push(`${x.confirmedAt ? '✅' : '⏳'} ${fmtDay(x.paidAt)} · <b>${som(x.amount)}</b>${x.note ? ' · ' + escH(x.note) : ''}`);
  return L.filter((x, i) => x !== '' || i === 1 || L[i - 1] !== '').join('\n');
}
export const PAY_ASK = (lang: Lang) => tr(lang, '💰 Qancha to‘lov qildingiz? Summani yozing, masalan: <b>1 000 000</b> yoki <b>1.5 mln avans</b>', '💰 Сколько вы оплатили? Напишите сумму, например: <b>1 000 000</b> или <b>1.5 млн аванс</b>');
export const PAY_BAD = (lang: Lang) => tr(lang, 'Summani tushunmadim. Raqam bilan yozing, masalan: 1 000 000', 'Не понял сумму. Напишите числом, например: 1 000 000');
