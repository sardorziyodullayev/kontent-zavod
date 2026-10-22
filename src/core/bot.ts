// Telegram bot matnlari va qarorlari (toza funksiyalar). Tarmoq va fayllar tools/worker.ts da.
import type { PlatformId, State, Video } from './types';
import { DAY, pname } from './constants';
import { allPosts, followersAt, postStats } from './model';
import { at, dayStart, fmtDate, fmtNum, fmtTime } from './format';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Tasdiq tugmasidan keyin asl xabarga reply: qaysi video, qachon, qayerga. */
export function approvedText(title: string, slot: number, platforms: PlatformId[]) {
  return `✅ <b>Tasdiqlandi:</b> ${esc(title)}
📅 ${fmtDate(slot, { weekday: true })}, ${fmtTime(slot)} · ${platforms.map(pname).join(' + ')}`;
}
export const postponedText = (title: string) => `⏸ <b>Keyinroq:</b> ${esc(title)}
Panelda tahrirlab, /tasdiq bilan qayta yuboring.`;

/** Egasining tasdig'ini kutayotgan video: "Yakuniy tasdiq"dan boshqa hamma bandi bajarilgan, hali rejalashtirilmagan. */
export function awaitingApproval(state: State): Video[] {
  return state.videos.filter((v) => {
    const rest = Object.entries(v.checklist).filter(([k]) => k !== 'approved');
    return !v.checklist.approved && rest.length > 0 && rest.every(([, x]) => x) && v.status !== 'published' && !v.posts.some((p) => p.status === 'scheduled' || p.status === 'published');
  });
}

/** Platformada hech narsa rejalashtirilmagan eng yaqin kun, soat `hour` (Toshkent). Bugungi soat o'tgan bo'lsa — ertadan. */
export function nextFreeSlot(state: State, now: number, platform: PlatformId, hour: number): number {
  const busy = new Set(allPosts(state).filter(({ p }) => p.platform === platform && (p.status === 'scheduled' || p.status === 'published')).map(({ p }) => dayStart(p.scheduledAt)));
  for (let d = 0; d < 60; d++) {
    const slot = at(now + d * DAY, hour);
    if (slot <= now + 30 * 60_000) continue; // kamida 30 daqiqa oldin rejalashtiriladi
    if (!busy.has(dayStart(slot))) return slot;
  }
  return at(now + 60 * DAY, hour);
}

export function approvalText(v: Video, slot: number, platforms: PlatformId[]): string {
  const desc = v.script.description.length > 600 ? v.script.description.slice(0, 600) + '…' : v.script.description;
  return [`🆕 <b>Tasdiqlash kerak</b>`, `<b>${esc(v.title)}</b>`, desc ? esc(desc) : '', v.script.hashtags ? esc(v.script.hashtags) : '',
    `\n⏰ Taklif: ${fmtDate(slot, { weekday: true })}, ${fmtTime(slot)} · ${platforms.map(pname).join(' + ')}`].filter(Boolean).join('\n');
}

/** /reja — keyingi 7 kunlik navbat. */
export function planText(state: State, now: number): string {
  const items = allPosts(state).filter(({ p }) => p.status === 'scheduled' && p.scheduledAt < now + 7 * DAY).sort((a, b) => a.p.scheduledAt - b.p.scheduledAt);
  const L = ['🗓 <b>Keyingi 7 kun</b>'];
  if (!items.length) L.push('Hech narsa rejalashtirilmagan.');
  for (const { v, p } of items) L.push(`${fmtDate(p.scheduledAt, { weekday: true })} ${fmtTime(p.scheduledAt)} · ${pname(p.platform)} — ${esc(v.title)}`);
  const waiting = awaitingApproval(state);
  if (waiting.length) L.push('', `⏸ Tasdiq kutmoqda: ${waiting.length} ta (${waiting.map((v) => esc(v.title)).join('; ')})`);
  return L.join('\n');
}

/** /statistika — obunachilar va oxirgi joylangan postlar. */
export function statsText(state: State, now: number): string {
  const L = ['📊 <b>Statistika</b>'];
  for (const pl of state.platforms.filter((x) => x.connected)) L.push(`${pname(pl.id)}: ${fmtNum(followersAt(state, pl.id, now))} obunachi`);
  const last = allPosts(state).filter(({ p }) => p.status === 'published' && p.publishedAt && p.publishedAt <= now).sort((a, b) => b.p.publishedAt! - a.p.publishedAt!).slice(0, 6);
  if (last.length) L.push('', '<b>Oxirgi joylanganlar</b>');
  for (const { v, p } of last) {
    const s = postStats(p, now);
    L.push(`${fmtDate(p.publishedAt!)} · ${pname(p.platform)} — ${esc(v.title)}${s.views ? ` · ${fmtNum(s.views)} ko‘rish` : ''}`);
  }
  return L.join('\n');
}

export const OWNER_HELP = ['🤖 <b>Buyruqlar</b>', '/hisobot — kunlik hisobot', '/reja — keyingi 7 kun', '/statistika — obunachilar va oxirgi postlar', '/yordam — shu ro‘yxat',
  '', 'Yangi video yoki post tayyor bo‘lsa, bot o‘zi yuboradi: ✅ bossangiz — keyingi bo‘sh vaqtga rejalashtiriladi.'].join('\n');

// ---------- obunachilar va mijozlar uchun ----------
export const PUBLIC_WELCOME = ['Assalomu alaykum! Bu — <b>PixelMind</b> boti 👋', '',
  'Biz kichik biznes uchun AI yechimlar qilamiz: mijozlarga javob beradigan bot, avtomatik kontent va hisobotlar.', '',
  'Quyidagilardan birini tanlang:'].join('\n');
export const PUBLIC_MENU = { inline_keyboard: [[{ text: '🧰 Xizmatlar', callback_data: 'svc' }], [{ text: '🎁 Bepul: 30 ta tayyor so‘rov', callback_data: 'gift' }], [{ text: '✍️ Murojaat qoldirish', callback_data: 'lead' }]] };
export const SERVICES_TEXT = ['🧰 <b>Xizmatlar</b>', '',
  '• <b>FAQ-bot</b> — mijozlarning tez-tez beradigan savollariga javob beradi, buyurtmani qabul qilib, sizga yuboradi.',
  '• <b>Kontent zavod</b> — biznesingiz uchun har kuni post va qisqa video: reja, matn, ovoz, montaj, avtomatik joylash.',
  '• <b>Hisobotlar</b> — Excel/Google Sheets formulalari va Telegram’ga avtomatik hisobot.',
  '• <b>AI darsi</b> — jamoangizga ChatGPT bilan amaliy ishlash.', '',
  'Narx loyihaga qarab belgilanadi. Murojaat qoldiring — bog‘lanamiz.'].join('\n');
export const LEAD_PROMPT = '✍️ Biznesingiz va vazifangiz haqida bitta xabarda yozing (nima qilasiz, qaysi ish ko‘p vaqt oladi). Xabaringiz egasiga yetkaziladi.';
export const LEAD_THANKS = 'Rahmat! Xabaringiz yetkazildi, tez orada javob beramiz. 🙌';
export const GIFT_MISSING = 'To‘plam tayyorlanmoqda — tez orada shu yerda bo‘ladi. Kanalni kuzatib boring: @pixelminduz';

export function leadText(from: { id: number; username?: string; first_name?: string; last_name?: string }, text: string): string {
  const who = [from.first_name, from.last_name].filter(Boolean).join(' ') || 'Noma’lum';
  return [`📩 <b>Yangi murojaat</b>`, `${esc(who)}${from.username ? ` (@${esc(from.username)})` : ''} · <a href="tg://user?id=${from.id}">profil</a>`, '', esc(text)].join('\n');
}
