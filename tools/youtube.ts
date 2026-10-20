// YouTube Data API v3: yuklash (resumable upload), video statistikasi va kanal obunachilari.
// Kalitlar: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN (npm run youtube:auth).
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

const API = 'https://www.googleapis.com/youtube/v3';
let cached: { token: string; until: number } | null = null;

export const youtubeConfigured = () => !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN);

async function accessToken() {
  if (cached && cached.until > Date.now() + 60_000) return cached.token;
  const r: { access_token?: string; expires_in?: number; error?: string; error_description?: string } = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID!, client_secret: process.env.YOUTUBE_CLIENT_SECRET!, refresh_token: process.env.YOUTUBE_REFRESH_TOKEN!, grant_type: 'refresh_token' }),
  })).json();
  if (!r.access_token) throw new Error(`YouTube token: ${r.error_description ?? r.error} — npm run youtube:auth bilan qayta ulang`);
  cached = { token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function yt<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await accessToken()}`, ...init.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`YouTube ${r.status}: ${(j as { error?: { message?: string } }).error?.message ?? r.statusText}`);
  return j as T;
}

export interface UploadMeta { title: string; description: string; hashtags: string; short: boolean }

/** Faylni YouTube'ga yuklaydi va video havolasini qaytaradi. */
export async function uploadVideo(file: string, m: UploadMeta) {
  const tags = m.hashtags.split(/\s+/).map((t) => t.replace(/^#/, '')).filter(Boolean).slice(0, 15);
  const meta = {
    snippet: { title: m.title.slice(0, 100), description: [m.description, m.hashtags].filter(Boolean).join('\n\n').slice(0, 5000), tags, categoryId: process.env.YOUTUBE_CATEGORY ?? '22' },
    status: { privacyStatus: process.env.YOUTUBE_PRIVACY ?? 'public', selfDeclaredMadeForKids: false },
  };
  const size = fs.statSync(file).size;
  const type = path.extname(file) === '.mov' ? 'video/quicktime' : 'video/mp4';
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': type, 'X-Upload-Content-Length': String(size) },
    body: JSON.stringify(meta),
  });
  const location = init.headers.get('location');
  if (!init.ok || !location) throw new Error(`YouTube yuklash boshlanmadi: ${init.status} ${await init.text()}`);
  const put = await fetch(location, {
    method: 'PUT',
    headers: { 'Content-Type': type, 'Content-Length': String(size) },
    body: Readable.toWeb(fs.createReadStream(file)) as ReadableStream,
    duplex: 'half',
  } as RequestInit);
  const v: { id?: string; status?: { privacyStatus?: string }; error?: { message?: string } } = await put.json();
  if (!put.ok || !v.id) throw new Error(`YouTube yuklash: ${v.error?.message ?? put.status}`);
  if (v.status?.privacyStatus === 'private' && meta.status.privacyStatus !== 'private') console.warn('YouTube videoni yopiq (private) qoldirdi: API loyihasi audit qilinmagan');
  return m.short ? `https://youtube.com/shorts/${v.id}` : `https://youtu.be/${v.id}`;
}

/** youtu.be/ID, youtube.com/shorts/ID, watch?v=ID → ID */
export function videoIdOf(url: string) {
  return url.match(/(?:youtu\.be\/|shorts\/|[?&]v=)([\w-]{11})/)?.[1] ?? null;
}

export interface VideoStats { views: number; likes: number; comments: number }

/** Bir nechta video statistikasi (50 tadan, har so'rov 1 birlik kvota). */
export async function videoStats(ids: string[]) {
  const out = new Map<string, VideoStats>();
  for (let i = 0; i < ids.length; i += 50) {
    const r = await yt<{ items: { id: string; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }>(`${API}/videos?part=statistics&id=${ids.slice(i, i + 50).join(',')}`);
    for (const it of r.items) out.set(it.id, { views: Number(it.statistics.viewCount ?? 0), likes: Number(it.statistics.likeCount ?? 0), comments: Number(it.statistics.commentCount ?? 0) });
  }
  return out;
}

export async function channel() {
  const r = await yt<{ items?: { snippet: { title: string; customUrl?: string }; statistics: { subscriberCount: string } }[] }>(`${API}/channels?part=snippet,statistics&mine=true`);
  const c = r.items?.[0];
  if (!c) throw new Error('YouTube: bu akkauntda kanal yo‘q');
  return { title: c.snippet.title, handle: c.snippet.customUrl ?? c.snippet.title, subscribers: Number(c.statistics.subscriberCount) };
}
