// Narxtop Google jadvalidagi ("AI Videos | NARXTOP", varaq "Общее") vazifalar va to'lovlarni panelga ko'chiradi.
// Ishga tushirish:  npx tsx --env-file=.env tools/import-narxtop.ts [--panel https://…] [--dry]
// Bir marta ishlatiladi: qayta ishga tushirsangiz, vazifalar ikki marta yoziladi (--dry bilan avval tekshiring).
import { normalizeDirection, normalizeStyle, type OrderStatus } from '../src/core/narxtop';

const SHEET = '1i4gdRRQmYte_9a3nx67IqZhuTBRfvI1PLWxCgrln-Is';
const arg = (k: string) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const PANEL = arg('--panel') ?? process.env.PANEL_URL ?? 'http://localhost:4310';
const DRY = process.argv.includes('--dry');
const headers = { 'Content-Type': 'application/json', ...(process.env.ADMIN_TOKEN ? { Authorization: `Bearer ${process.env.ADMIN_TOKEN}` } : {}) };

function parseCSV(s: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const STATUS: Record<string, OrderStatus> = { готово: 'done', правки: 'fix', 'в работе': 'work' };

type Item = { title: string; direction: string; style: string; status: OrderStatus };
type Block = { name: string; items: Item[]; notes: string[] };

async function main() {
  const csv = await (await fetch(`https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:csv&gid=0`)).text();
  const rows = parseCSV(csv);
  const blocks: Block[] = [];
  for (const r of rows) {
    // sarlavha qatori: "Название" ustuni; G ustunida oy nomi ("1 месяц", "2 месяц")
    if (/назван/i.test(r[1] ?? '')) { blocks.push({ name: `${blocks.length + 1}-oy`, items: [], notes: [] }); continue; }
    const b = blocks.at(-1);
    if (!b) continue;
    if (/оплат|оплач/i.test(r[6] ?? '')) b.notes.push(r[6].trim());
    const title = (r[1] ?? '').trim(), dir = (r[2] ?? '').trim(), style = (r[3] ?? '').trim(), st = (r[4] ?? '').trim().toLowerCase();
    if (!title && !dir && !style) continue; // bo'sh qator
    b.items.push({ title: title || `Nomsiz (${dir || 'yo‘nalishsiz'})`, direction: normalizeDirection(dir), style: normalizeStyle(style), status: STATUS[st] ?? 'new' });
  }
  for (const b of blocks) console.log(`${b.name}: ${b.items.length} ta vazifa · ${b.notes.join(' | ') || 'to‘lov yozuvi yo‘q'}`);
  if (DRY) return;

  const post = async <T>(p: string, body: unknown, method = 'POST'): Promise<T> => {
    const r = await fetch(PANEL + '/api/narxtop' + p, { method, headers, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`);
    return r.json() as Promise<T>;
  };
  for (const b of blocks) {
    const p = await post<{ id: number }>('/periods', { name: b.name, price: 0 });
    for (const it of b.items) {
      await post('/orders', { title: it.title, direction: it.direction, style: it.style, status: it.status, periodId: p.id, source: 'import' });
    }
    // To'lov matnlari erkin yozilgan: summalarni avtomatik taxmin qilmaymiz, izoh sifatida qoldiramiz — panelda qo'lda kiritiladi.
    console.log(`✓ ${b.name}: ${b.items.length} ta vazifa yozildi`);
  }
  console.log('Tayyor. To‘lov summalarini panelda “To‘lovlar” kartasida kiriting:', blocks.flatMap((b) => b.notes.map((n) => `${b.name}: ${n}`)).join(' | '));
}

await main();
