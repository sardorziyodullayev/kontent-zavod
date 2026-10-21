import { describe, expect, test } from 'vitest';
import * as C from '../src/core';

const NOW = Date.UTC(2026, 9, 21, 3, 0); // 21-okt 08:00 Toshkent

describe('ertalabki hisobot', () => {
  test('bugungi reja, ertangi reja va HTML xavfsiz', () => {
    const s = C.seed(NOW);
    const out = C.buildDigest(s, NOW);
    expect(out).toContain('Xayrli tong');
    expect(out).toContain('Bugun joylanadi');
    expect(out).toContain('Ertaga:');
    expect(out).not.toMatch(/<(?!\/?(b|a)[ >])/); // faqat <b> va <a> teglari
  });
  test('bo‘sh panel: reja yo‘q deb aytadi', () => {
    const s = C.emptyState(NOW);
    s.videos.push({ ...C.seed(NOW).videos[0], id: 'v1', title: 'A < B & C', status: 'idea', posts: [] });
    const out = C.buildDigest(s, NOW);
    expect(out).toContain('Hech narsa rejalashtirilmagan');
    expect(out).toContain('A &lt; B &amp; C');
  });
});
