import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../public/js/core.js';

const NOW = Date.UTC(2026, 9, 20, 6, 0); // 20-okt 11:00 Toshkent

test('seed deterministik va to‘liq', () => {
  const a = C.seed(NOW), b = C.seed(NOW);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.ok(a.videos.length > 80);
  assert.ok(C.allPosts(a).some(({ p }) => p.status === 'scheduled'));
  assert.ok(C.allPosts(a).some(({ p }) => p.status === 'failed'));
});

test('statistika vaqt bilan o‘sadi', () => {
  const s = C.seed(NOW);
  const { p } = C.allPosts(s).find(({ p }) => p.status === 'published');
  const a = C.postStats(p, p.publishedAt + C.HOUR).views;
  const b = C.postStats(p, p.publishedAt + C.DAY).views;
  assert.ok(b >= a && a >= 0);
  assert.equal(C.postStats(p, p.publishedAt - 1).views, 0);
});

test('tick: tayyor video joylanadi, tayyor bo‘lmagani o‘tkazib yuboriladi', () => {
  const s = C.seed(NOW);
  const ready = s.videos.find((v) => v.status === 'scheduled');
  const notReady = s.videos.find((v) => v.posts.some((p) => p.status === 'scheduled') && C.readiness(v) < 1);
  const later = Math.max(...[ready, notReady].flatMap((v) => v.posts.map((p) => p.scheduledAt))) + 1;
  C.tick(s, later);
  assert.ok(ready.posts.every((p) => p.status === 'published'));
  assert.ok(notReady.posts.every((p) => p.status === 'missed'));
});

test('simulyatsiya o‘chirilganda server o‘zi joylamaydi', () => {
  const s = C.seed(NOW);
  s.workspace.autoPublish = false;
  const v = s.videos.find((x) => x.status === 'scheduled');
  C.tick(s, NOW + 30 * C.DAY);
  assert.ok(v.posts.every((p) => p.status === 'scheduled'));
});

test('amallar: yaratish → tayyorlash → rejalashtirish → worker xabari → statistika', () => {
  const s = C.seed(NOW);
  const { result: v } = C.applyAction(s, { type: 'video.create', payload: { title: 'Test', topic: 'Hazil' } }, NOW);
  for (const c of C.CHECKLIST) C.applyAction(s, { type: 'video.check', payload: { id: v.id, key: c.id, value: true } }, NOW);
  assert.equal(v.status, 'ready');
  const { result: p } = C.applyAction(s, { type: 'post.schedule', payload: { videoId: v.id, platform: 'tiktok', scheduledAt: NOW + C.DAY } }, NOW);
  assert.equal(v.status, 'scheduled');
  assert.equal(C.nextQueue(s, NOW).find((q) => q.postId === p.id).ready, true);
  C.applyAction(s, { type: 'post.published', payload: { postId: p.id, url: 'https://x' } }, NOW + C.DAY);
  C.applyAction(s, { type: 'post.stats', payload: { postId: p.id, stats: { views: 1000, subs: 12 } } }, NOW + 2 * C.DAY);
  assert.equal(C.postStats(p, NOW + 3 * C.DAY).views, 1000);
  assert.equal(v.status, 'published');
});

test('prognoz oraliq beradi: lo ≤ mid ≤ hi', () => {
  const s = C.seed(NOW);
  const v = s.videos.find((x) => x.status === 'scheduled');
  const f = C.forecast(s, NOW, v, 'tiktok', NOW + C.DAY);
  assert.ok(f && f.lo <= f.mid && f.mid <= f.hi && f.n > 5);
});

test('ogohlantirishlar va tavsiyalar bor', () => {
  const s = C.seed(NOW);
  assert.ok(C.alerts(s, NOW).length > 0);
  assert.ok(C.insights(s, NOW).length > 0);
});

test('CSV sarlavhasi', () => {
  assert.ok(C.toCSV(C.seed(NOW), NOW).startsWith('"video_id","sarlavha"'));
});
