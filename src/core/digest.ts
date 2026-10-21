// Ertalabki hisobot: egasiga Telegram orqali yuboriladigan qisqa xulosa (HTML parse_mode). Toza funksiya.
import type { State } from './types';
import { DAY, STAGES, pname } from './constants';
import { alerts } from './analytics';
import { awaitingApproval } from './bot';
import { allPosts, followersAt, postStats, readiness } from './model';
import { dayStart, fmtDate, fmtNum, fmtTime } from './format';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ICON = { critical: '🔴', serious: '🟠', warning: '🟡', good: '🟢' } as const;

export function buildDigest(state: State, now: number): string {
  const today = dayStart(now);
  const posts = allPosts(state);
  const L: string[] = [`☀️ <b>Xayrli tong!</b> ${esc(state.workspace.name)} · ${fmtDate(now, { weekday: true })}`];

  const todays = posts.filter(({ p }) => p.status === 'scheduled' && p.scheduledAt >= today && p.scheduledAt < today + DAY).sort((a, b) => a.p.scheduledAt - b.p.scheduledAt);
  L.push('', '📅 <b>Bugun joylanadi</b>');
  if (!todays.length) L.push('Hech narsa rejalashtirilmagan.');
  for (const { v, p } of todays) {
    const r = readiness(v);
    L.push(`${fmtTime(p.scheduledAt)} · ${pname(p.platform)} — ${esc(v.title)} ${r >= 1 ? '✅' : `⚠️ ${Math.round(r * 100)}% tayyor`}`);
  }

  const yday = posts.filter(({ p }) => p.status === 'published' && p.publishedAt && p.publishedAt >= today - DAY && p.publishedAt < today);
  if (yday.length) {
    L.push('', '✅ <b>Kecha chiqdi</b>');
    for (const { v, p } of yday) {
      const views = postStats(p, now).views;
      const name = p.url ? `<a href="${esc(p.url)}">${esc(v.title)}</a>` : esc(v.title);
      L.push(`${pname(p.platform)} — ${name}${views ? ` · ${fmtNum(views)} ko‘rish` : ''}`);
    }
  }

  const tomorrow = posts.filter(({ p }) => p.status === 'scheduled' && p.scheduledAt >= today + DAY && p.scheduledAt < today + 2 * DAY);
  L.push('', `🗓 <b>Ertaga:</b> ${tomorrow.length ? tomorrow.map(({ v, p }) => `${fmtTime(p.scheduledAt)} ${pname(p.platform)} — ${esc(v.title)}`).join('; ') : 'reja yo‘q'}`);

  const subs = state.platforms.filter((pl) => pl.connected).map((pl) => `${pname(pl.id)} ${fmtNum(followersAt(state, pl.id, now))}`);
  if (subs.length) L.push(`👥 <b>Obunachilar:</b> ${subs.join(' · ')}`);

  const counts = STAGES.filter((s) => s.id !== 'published').map((s) => [s.name, state.videos.filter((v) => v.status === s.id).length] as const).filter(([, n]) => n);
  if (counts.length) L.push(`🏭 <b>Zavod:</b> ${counts.map(([n, c]) => `${n} ${c}`).join(' · ')}`);

  // keyingi ishlanadigan: rejalashtirilmagan eng birinchi video (reja tartibida)
  const waiting = awaitingApproval(state);
  if (waiting.length) L.push(`⏸ <b>Tasdiq kutmoqda:</b> ${waiting.length} ta — /tasdiq`);
  const next = state.videos.find((v) => ['idea', 'script', 'production', 'editing'].includes(v.status) && !waiting.includes(v));
  if (next) L.push(`▶️ <b>Navbatdagi ish:</b> ${esc(next.title)}${next.notes ? ` (${esc(next.notes.split('\n')[0])})` : ''}`);

  const al = alerts(state, now).slice(0, 4);
  if (al.length) {
    L.push('', '❗ <b>Diqqat</b>');
    for (const a of al) L.push(`${ICON[a.level]} ${esc(a.title)} — ${esc(a.text)}`);
  }
  return L.join('\n');
}
