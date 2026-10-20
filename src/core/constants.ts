import type { ChecklistKey, Format, PlatformId, Stage } from './types';

export const HOUR = 3600e3;
export const DAY = 24 * HOUR;
export const TZ_OFFSET = 5 * HOUR; // Asia/Tashkent, yozgi vaqt yo'q

export const PLATFORMS: { id: PlatformId; name: string; short: string }[] = [
  { id: 'youtube', name: 'YouTube', short: 'YT' },
  { id: 'instagram', name: 'Instagram', short: 'IG' },
  { id: 'tiktok', name: 'TikTok', short: 'TT' },
  { id: 'telegram', name: 'Telegram', short: 'TG' },
  { id: 'facebook', name: 'Facebook', short: 'FB' },
];
export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);
export const pname = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)?.name ?? id;
export const pshort = (id: PlatformId) => PLATFORMS.find((p) => p.id === id)?.short ?? id;

export const STAGES: { id: Stage; name: string }[] = [
  { id: 'idea', name: 'G‘oya' },
  { id: 'script', name: 'Ssenariy' },
  { id: 'production', name: 'Suratga olish' },
  { id: 'editing', name: 'Montaj' },
  { id: 'ready', name: 'Tayyor' },
  { id: 'scheduled', name: 'Rejalashtirilgan' },
  { id: 'published', name: 'Joylandi' },
];
export const stageName = (id: Stage) => STAGES.find((s) => s.id === id)?.name ?? id;

export const CHECKLIST: { id: ChecklistKey; name: string }[] = [
  { id: 'script', name: 'Ssenariy yozildi' },
  { id: 'voice', name: 'Ovoz yozildi' },
  { id: 'footage', name: 'Suratga olindi / render' },
  { id: 'edit', name: 'Montaj tugadi' },
  { id: 'thumbnail', name: 'Muqova (thumbnail)' },
  { id: 'subtitles', name: 'Subtitr' },
  { id: 'caption', name: 'Sarlavha, tavsif, hashtag' },
  { id: 'approved', name: 'Yakuniy tasdiq' },
];

export const TOPICS = ['AI vositalari', 'Biznes uchun AI', 'AI yangiliklar', 'Darslik', 'AI bilan daromad', 'Avtomatlashtirish'];
export const FORMATS: { id: Format; name: string }[] = [
  { id: 'short', name: 'Qisqa (Shorts/Reels)' },
  { id: 'long', name: 'Uzun video' },
];
export const OWNERS = ['Sardor', 'Madina', 'Jasur'];

export const SCRIPT_TEMPLATES = [
  { id: 'problem', name: 'Muammo → Yechim → CTA', hook: 'Siz ham … muammosiga duch kelganmisiz?', body: '1) Muammo nima va nega muhim.\n2) Yechim: qadam-baqadam.\n3) Natija: oldin / keyin.', cta: 'Saqlab qo‘ying va do‘stingizga yuboring.' },
  { id: 'top3', name: 'Top 3 ro‘yxat', hook: '… uchun 3 ta narsa, uchinchisi sizni hayron qoldiradi.', body: '3-o‘rin: …\n2-o‘rin: …\n1-o‘rin: …', cta: 'Qaysi biri yoqdi? Izohda yozing.' },
  { id: 'beforeafter', name: 'Oldin / Keyin', hook: 'Mana bu 30 soniyada qanday o‘zgardi.', body: 'Oldin: …\nNima qildik: …\nKeyin: …', cta: 'To‘liq darslik uchun obuna bo‘ling.' },
  { id: 'story', name: 'Hikoya', hook: 'Kecha shunday voqea bo‘ldi…', body: 'Boshlanish: …\nBurilish: …\nXulosa: …', cta: 'Davomi keyingi videoda — obuna bo‘ling.' },
];

export const SLOTS = [6, 8, 10, 12, 14, 16, 18, 20, 22]; // 2 soatlik bloklar boshlanishi
export const DOW_NAMES = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
export const DOW_SHORT = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
export const MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
export const MONTHS_FULL = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
