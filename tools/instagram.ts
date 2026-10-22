// Instagram (Instagram Login API, graph.instagram.com): Reels joylash va obunachilar.
// Kalitlar: IG_USER_ID, IG_ACCESS_TOKEN (Meta app → Instagram → API setup → Generate token; 60 kunlik).
// Token muddati o'tmasin: haftasiga bir yangilanadi va DATA_DIR/ig-token.json ga yoziladi (Turso'ga ham nusxa).
import fs from 'node:fs';
import path from 'node:path';
import { mirrorSoon } from '../server/files';

const GRAPH = 'https://graph.instagram.com';
const TOKEN_FILE = path.join(process.env.DATA_DIR ?? './data', 'ig-token.json');
const WEEK = 7 * 24 * 3600_000;

export const instagramConfigured = () => !!(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN);

type Saved = { token: string; refreshedAt: number; expiresAt: number };
const saved = (): Saved | null => { try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch { return null; } };
const token = () => saved()?.token ?? process.env.IG_ACCESS_TOKEN!;

async function ig<T>(p: string, params: Record<string, string> = {}, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const q = new URLSearchParams({ ...params, access_token: token() });
  const r = method === 'GET' ? await fetch(`${GRAPH}/${p}?${q}`) : await fetch(`${GRAPH}/${p}`, { method, body: q });
  const j = (await r.json()) as T & { error?: { message: string } };
  if (j.error) throw new Error(`Instagram ${p.split('?')[0]}: ${j.error.message}`);
  return j;
}

/** Haftasiga bir marta uzoq muddatli tokenni yangilaydi (token kamida 24 soatlik bo'lishi kerak). */
export async function refreshToken() {
  const s = saved();
  if (s && Date.now() - s.refreshedAt < WEEK) return;
  const r = await ig<{ access_token: string; expires_in: number }>('refresh_access_token', { grant_type: 'ig_refresh_token' });
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token: r.access_token, refreshedAt: Date.now(), expiresAt: Date.now() + r.expires_in * 1000 } satisfies Saved));
  mirrorSoon(TOKEN_FILE);
  console.log('Instagram token yangilandi');
}

export const account = () => ig<{ username: string; followers_count: number; media_count: number }>('me', { fields: 'username,followers_count,media_count' });

/** Reels: konteyner → tayyor bo'lishini kutish → joylash. Video ochiq havoladan olinadi (Instagram o'zi yuklab oladi). */
export async function publishReel(videoUrl: string, caption: string) {
  const user = process.env.IG_USER_ID!;
  const { id } = await ig<{ id: string }>(`${user}/media`, { media_type: 'REELS', video_url: videoUrl, caption: caption.slice(0, 2200), share_to_feed: 'true' }, 'POST');
  for (let i = 0; ; i++) {
    const st = await ig<{ status_code: string; status?: string }>(id, { fields: 'status_code,status' });
    if (st.status_code === 'FINISHED') break;
    if (st.status_code === 'ERROR' || st.status_code === 'EXPIRED') throw new Error(`Instagram videoni qabul qilmadi: ${st.status ?? st.status_code}`);
    if (i >= 60) throw new Error('Instagram videoni 10 daqiqada qayta ishlamadi');
    await new Promise((ok) => setTimeout(ok, 10_000));
  }
  const pub = await ig<{ id: string }>(`${user}/media_publish`, { creation_id: id }, 'POST');
  const { permalink } = await ig<{ permalink: string }>(pub.id, { fields: 'permalink' });
  return permalink;
}
