// YouTube Data API v3: yuklash (resumable upload), video statistikasi va kanal obunachilari.
// Kalitlar: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN (npm run youtube:auth).
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { ChannelVideo, ExtChannel } from '../src/core/types';

const API = 'https://www.googleapis.com/youtube/v3';
const cached = new Map<string, { token: string; until: number }>(); // refresh token → access token

export const youtubeConfigured = () => !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN);

async function accessToken(refresh = process.env.YOUTUBE_REFRESH_TOKEN!) {
  const c = cached.get(refresh);
  if (c && c.until > Date.now() + 60_000) return c.token;
  const r: { access_token?: string; expires_in?: number; error?: string; error_description?: string } = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: process.env.YOUTUBE_CLIENT_ID!, client_secret: process.env.YOUTUBE_CLIENT_SECRET!, refresh_token: refresh, grant_type: 'refresh_token' }),
  })).json();
  if (!r.access_token) throw new Error(`YouTube token: ${r.error_description ?? r.error} — npm run youtube:auth bilan qayta ulang`);
  cached.set(refresh, { token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 });
  return r.access_token;
}

async function yt<T>(url: string, init: RequestInit = {}, refresh?: string): Promise<T> {
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await accessToken(refresh)}`, ...init.headers } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`YouTube ${r.status}: ${(j as { error?: { message?: string } }).error?.message ?? r.statusText}`);
  return j as T;
}

export interface UploadMeta { title: string; description: string; hashtags: string; short: boolean; tags?: string[]; publishAt?: number }

/** Faylni YouTube'ga yuklaydi va video havolasini qaytaradi. */
export async function uploadVideo(file: string, m: UploadMeta) {
  const tags = m.tags ?? m.hashtags.split(/\s+/).map((t) => t.replace(/^#/, '')).filter(Boolean).slice(0, 15);
  const meta = {
    snippet: { title: m.title.slice(0, 100), description: [m.description, m.hashtags].filter(Boolean).join('\n\n').slice(0, 5000), tags, categoryId: process.env.YOUTUBE_CATEGORY ?? '22' },
    // publishAt: video yopiq yuklanadi va YouTube uni shu vaqtda o'zi ochadi. Ovoz AI bilan — "altered or synthetic content" belgisi.
    status: { privacyStatus: m.publishAt ? 'private' : process.env.YOUTUBE_PRIVACY ?? 'public', ...(m.publishAt ? { publishAt: new Date(m.publishAt).toISOString() } : {}), selfDeclaredMadeForKids: false, containsSyntheticMedia: true },
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
  if (v.status?.privacyStatus === 'private' && meta.status.privacyStatus !== 'private' && !m.publishAt) console.warn('YouTube videoni yopiq (private) qoldirdi: API loyihasi audit qilinmagan');
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

/** "PT4M55S" → 295 */
export function isoDuration(d: string) {
  const m = d.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  return m ? (Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0)) : 0;
}

/** Kuzatiladigan kanal (o'z refresh tokeni bilan): umumiy statistika va oxirgi 50 ta video, yopiqlari ham. Kvota: ~3 birlik. */
export async function extChannel(key: string, refresh: string): Promise<Omit<ExtChannel, 'history' | 'syncedAt'>> {
  type Ch = { id: string; snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url: string } } }; statistics: { subscriberCount: string; viewCount: string; videoCount: string }; contentDetails: { relatedPlaylists: { uploads: string } } };
  const c = (await yt<{ items?: Ch[] }>(`${API}/channels?part=snippet,statistics,contentDetails&mine=true`, {}, refresh)).items?.[0];
  if (!c) throw new Error(`YouTube (${key}): kanal topilmadi`);
  const pl = await yt<{ items?: { contentDetails: { videoId: string } }[] }>(`${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${c.contentDetails.relatedPlaylists.uploads}`, {}, refresh);
  const ids = (pl.items ?? []).map((i) => i.contentDetails.videoId);
  type V = { id: string; snippet: { title: string; publishedAt: string }; status: { privacyStatus: ChannelVideo['privacy']; publishAt?: string }; contentDetails: { duration: string }; statistics: { viewCount?: string; likeCount?: string; commentCount?: string } };
  const vs = ids.length ? (await yt<{ items: V[] }>(`${API}/videos?part=snippet,status,contentDetails,statistics&id=${ids.join(',')}`, {}, refresh)).items : [];
  return {
    id: c.id, key, title: c.snippet.title, handle: c.snippet.customUrl ?? c.snippet.title, thumb: c.snippet.thumbnails?.default?.url,
    subscribers: Number(c.statistics.subscriberCount), views: Number(c.statistics.viewCount), videoCount: Number(c.statistics.videoCount),
    videos: vs.map((v) => ({
      id: v.id, title: v.snippet.title, publishedAt: Date.parse(v.snippet.publishedAt), privacy: v.status.privacyStatus, publishAt: v.status.publishAt ? Date.parse(v.status.publishAt) : null,
      duration: isoDuration(v.contentDetails.duration), views: Number(v.statistics.viewCount ?? 0), likes: Number(v.statistics.likeCount ?? 0), comments: Number(v.statistics.commentCount ?? 0),
    })),
  };
}
