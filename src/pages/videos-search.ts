// Videolar sahifasi filtrlari (URL search) — router asosiy faylda shu kichik moduldan foydalanadi, sahifaning o'zi alohida yuklanadi.
export type SortKey = 'date' | 'views' | 'er' | 'ret' | 'subs' | 'title';
export interface VideoSearch { q?: string; platform?: string; topic?: string; format?: string; status?: string; sort?: SortKey; dir?: 1 | -1 }

/** Filtrlar URL'da saqlanadi — havolani ulashsangiz o'sha ko'rinish ochiladi. */
export const videoSearch = (s: Record<string, unknown>): VideoSearch => ({
  q: typeof s.q === 'string' && s.q ? s.q : undefined,
  platform: typeof s.platform === 'string' ? s.platform : undefined,
  topic: typeof s.topic === 'string' ? s.topic : undefined,
  format: typeof s.format === 'string' ? s.format : undefined,
  status: typeof s.status === 'string' ? s.status : undefined,
  sort: ['date', 'views', 'er', 'ret', 'subs', 'title'].includes(s.sort as string) ? (s.sort as SortKey) : undefined,
  dir: s.dir === 1 ? 1 : s.dir === -1 ? -1 : undefined,
});
