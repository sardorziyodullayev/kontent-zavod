import { describe, expect, test } from 'vitest';
import * as N from '../src/core/narxtop';

const order = (o: Partial<N.Order>): N.Order => ({
  id: 1, periodId: 1, title: 'A', direction: '', style: '', status: 'new', script: '', videoUrl: '', note: '', deadline: null,
  createdAt: 0, doneAt: null, createdBy: '', source: 'panel', files: [], log: [], ...o,
});

describe('narxtop', () => {
  test('yo‘nalish nomlari bir xil yoziladi (jadvaldagi xatolar)', () => {
    expect(N.normalizeDirection('Аавтосалоны ')).toBe('Avtosalonlar');
    expect(N.normalizeDirection('Автосалон')).toBe('Avtosalonlar');
    expect(N.normalizeDirection('Мфо')).toBe('MFO');
    expect(N.normalizeDirection('МФО')).toBe('MFO');
    expect(N.normalizeDirection('интернет ')).toBe('Internet');
    expect(N.normalizeDirection('Недвижимость ')).toBe('Novostroyka');
    expect(N.normalizeDirection('интернет провайдеры парнеры')).toBe('Internet');
    expect(N.normalizeDirection('banklar')).toBe('Banklar');
    expect(N.normalizeDirection('')).toBe('');
    expect(N.normalizeDirection('yangi tur')).toBe('Yangi tur');
    expect(N.normalizeStyle('Мультик ')).toBe('Multfilm');
    expect(N.normalizeStyle('реал')).toBe('Real');
  });

  test('sarlavha ssenariyning birinchi mazmunli qatoridan', () => {
    expect(N.titleFrom('\n\n**Qahramon va NARXTOP**\nKadr 1: …')).toBe('Qahramon va NARXTOP');
    expect(N.titleFrom('x'.repeat(120))).toHaveLength(79);
    expect(N.titleFrom('')).toBe('Yangi vazifa');
  });

  test('hisobot: holat, yo‘nalish va to‘lov qoldig‘i avtomatik', () => {
    const os = [
      order({ id: 1, direction: 'NARXTOP', status: 'done' }),
      order({ id: 2, direction: 'NARXTOP', status: 'work' }),
      order({ id: 3, direction: 'MFO', status: 'fix' }),
      order({ id: 4, status: 'new' }),
    ];
    const s = N.summarize(os, { id: 1, name: '2-oy', price: 5_000_000, createdAt: 0, closedAt: null }, [
      { id: 1, periodId: 1, amount: 3_000_000, paidAt: 0, note: '', createdBy: '', confirmedAt: 1 },
      { id: 2, periodId: 1, amount: 1_300_000, paidAt: 0, note: '', createdBy: '', confirmedAt: null },
    ]);
    expect(s).toMatchObject({ total: 4, done: 1, open: 3, paid: 4_300_000, left: 700_000, pending: 1_300_000 });
    expect(s.byStatus).toEqual({ new: 1, work: 1, review: 0, fix: 1, done: 1 });
    expect(s.byDirection[0]).toEqual({ name: 'NARXTOP', total: 2, done: 1 });
    expect(s.byDirection.find((g) => g.name === 'Ko‘rsatilmagan')?.total).toBe(1);
    expect(N.som(5_000_000)).toBe('5 000 000');
  });

  test('to‘lov summasi matndan', () => {
    expect(N.parseAmount('1 000 000')).toEqual({ amount: 1_000_000, note: '' });
    expect(N.parseAmount('1.5 mln avans')).toEqual({ amount: 1_500_000, note: 'avans' });
    expect(N.parseAmount('1,5 млн аванс')).toEqual({ amount: 1_500_000, note: 'аванс' });
    expect(N.parseAmount('500 ming')).toEqual({ amount: 500_000, note: '' });
    expect(N.parseAmount('предоплата 300к')).toEqual({ amount: 300_000, note: 'предоплата' });
    expect(N.parseAmount('1300000')).toEqual({ amount: 1_300_000, note: '' });
    expect(N.parseAmount('salom')).toBeNull();
    expect(N.parseAmount('5')).toBeNull();
  });

  test('rus tili: nomlar, holatlar, tarix va bot matni', () => {
    expect(N.label('Avtosalonlar', 'ru')).toBe('Автосалоны');
    expect(N.label('Multfilm', 'ru')).toBe('Мультик');
    expect(N.label('Yangi tur', 'ru')).toBe('Yangi tur');
    expect(N.label('Avtosalonlar', 'uz')).toBe('Avtosalonlar');
    expect(N.statusLabel('fix', 'ru')).toBe('Правки');
    expect(N.logLabel('Holat: Yangi → Tayyor', 'ru')).toBe('Статус: Новое → Готово');
    expect(N.logLabel('Yo‘nalish: MFO', 'ru')).toBe('Направление: МФО');
    expect(N.logLabel('💬 tuzating', 'ru')).toBe('💬 tuzating');
    expect(N.createdText({ id: 5, title: 'A', direction: 'Banklar', style: '' }, 'style', 'ru')).toContain('Направление: Банки');
    expect(N.choiceKeyboard('s', 5, N.DEFAULT_STYLES, 'ru').inline_keyboard[0][0].text).toBe('Мультик');
  });

  test('bot: bajarilmagan vazifalar ro‘yxati va tugmalar', () => {
    const d: N.NarxtopData = {
      periods: [{ id: 1, name: '1-oy', price: 0, createdAt: 0, closedAt: 1 }, { id: 2, name: '2-oy', price: 0, createdAt: 1, closedAt: null }],
      orders: [order({ id: 1, periodId: 1, title: 'Eski' }), order({ id: 2, periodId: 2, title: 'Serial <7>', status: 'work' }), order({ id: 3, periodId: 2, status: 'done' })],
      payments: [], directions: N.DEFAULT_DIRECTIONS, styles: N.DEFAULT_STYLES, bot: null,
    };
    const t = N.openTasksText(d);
    expect(t).toContain('2-oy');
    expect(t).toContain('Serial &lt;7&gt;');
    expect(t).not.toContain('Eski');
    const kb = N.choiceKeyboard('d', 12, N.DEFAULT_DIRECTIONS);
    expect(kb.inline_keyboard[0]).toHaveLength(3);
    expect(kb.inline_keyboard.flat().every((b) => b.callback_data.length <= 64)).toBe(true);
    expect(kb.inline_keyboard.at(-1)![0].callback_data).toBe('nx:d:12:-1');
  });
});
