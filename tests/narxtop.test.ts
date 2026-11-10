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
    const s = N.summarize(os, { id: 1, name: '2-oy', price: 5_000_000, createdAt: 0 }, [
      { id: 1, periodId: 1, amount: 3_000_000, paidAt: 0, note: '' },
      { id: 2, periodId: 1, amount: 1_300_000, paidAt: 0, note: '' },
    ]);
    expect(s).toMatchObject({ total: 4, done: 1, open: 3, paid: 4_300_000, left: 700_000 });
    expect(s.byStatus).toEqual({ new: 1, work: 1, review: 0, fix: 1, done: 1 });
    expect(s.byDirection[0]).toEqual({ name: 'NARXTOP', total: 2, done: 1 });
    expect(s.byDirection.find((g) => g.name === 'Ko‘rsatilmagan')?.total).toBe(1);
    expect(N.som(5_000_000)).toBe('5 000 000');
  });

  test('bot: bajarilmagan vazifalar ro‘yxati va tugmalar', () => {
    const d: N.NarxtopData = {
      periods: [{ id: 1, name: '1-oy', price: 0, createdAt: 0 }, { id: 2, name: '2-oy', price: 0, createdAt: 1 }],
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
