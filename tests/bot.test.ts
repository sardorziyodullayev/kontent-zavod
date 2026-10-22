import { describe, expect, test } from 'vitest';
import * as C from '../src/core';

const NOW = Date.UTC(2026, 9, 22, 3, 0); // 22-okt 08:00 Toshkent

function ready(s: C.State, title: string) {
  const v: C.Video = { ...C.seed(NOW).videos[0], id: 'v' + (100 + s.videos.length), title, status: 'script', posts: [] };
  v.checklist = { script: true, voice: true, footage: true, edit: true, thumbnail: true, subtitles: true, caption: true, approved: false };
  s.videos.push(v);
  return v;
}

describe('telegram bot', () => {
  test('tasdiq kutayotganlar: faqat "Yakuniy tasdiq" qolgan va rejasiz', () => {
    const s = C.emptyState(NOW);
    const a = ready(s, 'A');
    const b = ready(s, 'B');
    b.checklist.voice = false;
    const c = ready(s, 'C');
    c.checklist.approved = true;
    expect(C.awaitingApproval(s).map((v) => v.id)).toEqual([a.id]);
  });
  test('bo‘sh vaqt: band kun o‘tkazib yuboriladi, o‘tgan soat — ertaga', () => {
    const s = C.emptyState(NOW);
    const v = ready(s, 'A');
    const today20 = C.at(NOW, 20);
    v.posts.push({ id: 'p1', platform: 'telegram', scheduledAt: today20, publishedAt: null, status: 'scheduled', model: null, snapshots: [] });
    expect(C.nextFreeSlot(s, NOW, 'telegram', 20)).toBe(C.at(NOW + C.DAY, 20)); // bugun band
    expect(C.nextFreeSlot(s, NOW, 'telegram', 6)).toBe(C.at(NOW + C.DAY, 6));   // 06:00 o'tib ketgan
    expect(C.nextFreeSlot(s, NOW, 'youtube', 20)).toBe(today20);               // boshqa platforma bo'sh
  });
  test('matnlar HTML uchun xavfsiz', () => {
    const s = C.emptyState(NOW);
    const v = ready(s, 'A < B & C');
    expect(C.approvalText(v, C.at(NOW, 20), ['telegram'])).toContain('A &lt; B &amp; C');
    const ok = C.approvedText('A < B', C.at(NOW, 20), ['telegram', 'youtube']);
    expect(ok).toContain('Tasdiqlandi:</b> A &lt; B');
    expect(ok).toContain('20:00');
    expect(C.postponedText('X & Y')).toContain('X &amp; Y');
    expect(C.planText(s, NOW)).toContain('Tasdiq kutmoqda: 1');
    expect(C.leadText({ id: 5, first_name: '<b>' }, 'x & y')).toContain('&lt;b&gt;');
    expect(C.statsText(s, NOW)).toContain('Statistika');
  });
});
