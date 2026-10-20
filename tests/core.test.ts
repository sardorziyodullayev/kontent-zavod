import { describe, expect, test } from 'vitest';
import * as C from '../src/core';

const NOW = Date.UTC(2026, 9, 20, 6, 0); // 20-okt 11:00 Toshkent

describe('yadro', () => {
  test('seed deterministik va to‘liq', () => {
    const a = C.seed(NOW), b = C.seed(NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.videos.length).toBeGreaterThan(80);
    expect(C.allPosts(a).some(({ p }) => p.status === 'scheduled')).toBe(true);
    expect(C.allPosts(a).some(({ p }) => p.status === 'failed')).toBe(true);
  });

  test('statistika vaqt bilan o‘sadi', () => {
    const s = C.seed(NOW);
    const { p } = C.allPosts(s).find(({ p }) => p.status === 'published')!;
    const a = C.postStats(p, p.publishedAt! + C.HOUR).views;
    const b = C.postStats(p, p.publishedAt! + C.DAY).views;
    expect(b).toBeGreaterThanOrEqual(a);
    expect(C.postStats(p, p.publishedAt! - 1).views).toBe(0);
  });

  test('tick: tayyor video joylanadi, tayyor bo‘lmagani o‘tkazib yuboriladi', () => {
    const s = C.seed(NOW);
    const ready = s.videos.find((v) => v.status === 'scheduled')!;
    const notReady = s.videos.find((v) => v.posts.some((p) => p.status === 'scheduled') && C.readiness(v) < 1)!;
    const later = Math.max(...[ready, notReady].flatMap((v) => v.posts.map((p) => p.scheduledAt))) + 1;
    C.tick(s, later);
    expect(ready.posts.every((p) => p.status === 'published')).toBe(true);
    expect(notReady.posts.every((p) => p.status === 'missed')).toBe(true);
  });

  test('simulyatsiya o‘chirilganda server o‘zi joylamaydi', () => {
    const s = C.seed(NOW);
    s.workspace.autoPublish = false;
    const v = s.videos.find((x) => x.status === 'scheduled')!;
    C.tick(s, NOW + 30 * C.DAY);
    expect(v.posts.every((p) => p.status === 'scheduled')).toBe(true);
  });

  test('to‘liq oqim: yaratish → tayyorlash → rejalashtirish → worker → statistika', () => {
    const s = C.seed(NOW);
    const v = C.applyAction(s, { type: 'video.create', payload: { title: 'Test', topic: 'Avtomatlashtirish' } }, NOW) as C.Video;
    for (const c of C.CHECKLIST) C.applyAction(s, { type: 'video.check', payload: { id: v.id, key: c.id, value: true } }, NOW);
    expect(v.status).toBe('ready');
    const p = C.applyAction(s, { type: 'post.schedule', payload: { videoId: v.id, platform: 'tiktok', scheduledAt: NOW + C.DAY } }, NOW) as C.Post;
    expect(v.status).toBe('scheduled');
    expect(C.nextQueue(s, NOW).find((q) => q.postId === p.id)?.ready).toBe(true);
    C.applyAction(s, { type: 'post.published', payload: { postId: p.id, url: 'https://x' } }, NOW + C.DAY);
    C.applyAction(s, { type: 'post.stats', payload: { postId: p.id, stats: { views: 1000, subs: 12 } } }, NOW + 2 * C.DAY);
    expect(C.postStats(p, NOW + 3 * C.DAY).views).toBe(1000);
    expect(v.status).toBe('published');
  });

  test('noto‘g‘ri amal xato beradi', () => {
    const s = C.seed(NOW);
    expect(() => C.applyAction(s, { type: 'video.delete', payload: { id: 'yoq' } }, NOW)).toThrow(C.ActionError);
  });

  test('prognoz oraliq beradi: lo ≤ mid ≤ hi', () => {
    const s = C.seed(NOW);
    const v = s.videos.find((x) => x.status === 'scheduled')!;
    const f = C.forecast(s, NOW, v, 'tiktok', NOW + C.DAY)!;
    expect(f.lo).toBeLessThanOrEqual(f.mid);
    expect(f.mid).toBeLessThanOrEqual(f.hi);
    expect(f.n).toBeGreaterThan(5);
  });

  test('ogohlantirishlar, tavsiyalar va CSV', () => {
    const s = C.seed(NOW);
    expect(C.alerts(s, NOW).length).toBeGreaterThan(0);
    expect(C.insights(s, NOW).length).toBeGreaterThan(0);
    expect(C.toCSV(s, NOW).startsWith('"video_id","sarlavha"')).toBe(true);
  });
  test('toza holat: namunaviy ma’lumotsiz, simulyatsiya o‘chiq, analitika buzilmaydi', () => {
    const demo = C.seed(NOW);
    const keep = demo.videos.filter((v) => v.posts.some((p) => p.platform === 'telegram' && p.status === 'published')).slice(-1);
    keep[0].posts.forEach((p) => { p.model = null; }); // haqiqiy post: statistika hali kelmagan
    const s = C.emptyState(NOW, demo, keep);
    expect(s.workspace.autoPublish).toBe(false);
    expect(s.videos.length).toBe(1);
    expect(s.nextId).toEqual(demo.nextId);
    expect(C.followersAt(s, 'telegram', NOW + C.DAY)).toBe(0);
    C.applyAction(s, { type: 'platform.update', payload: { id: 'telegram', patch: { followers: 412 } } }, NOW);
    expect(C.followersAt(s, 'telegram', NOW + C.DAY)).toBe(412);
    expect(() => { C.kpis(s, NOW, 30); C.alerts(s, NOW); C.insights(s, NOW); C.nextQueue(s, NOW); C.dailySeries(s, NOW - 30 * C.DAY, NOW); }).not.toThrow();
  });
});
