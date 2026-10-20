// Amallar: panel, server va worker bir xil amallarni ishlatadi. Holat joyida o'zgaradi.
import { CHECKLIST, PLATFORM_IDS, TOPICS, pname, stageName } from './constants';
import { fmtDate, fmtTime } from './format';
import { emptyChecklist, emptyScript, followersAt, log, readiness, tick } from './model';
import type { ChecklistKey, Format, Goals, PlatformId, Post, Script, Stage, State, Stats, Video, Workspace } from './types';

export type Action =
  | { type: 'video.create'; payload: { title?: string; topic?: string; format?: Format; duration?: number; status?: Stage; owner?: string; hook?: string; notes?: string } }
  | { type: 'video.update'; payload: { id: string; patch: Partial<Pick<Video, 'title' | 'topic' | 'format' | 'duration' | 'notes' | 'owner'>> & { script?: Partial<Script> } } }
  | { type: 'video.move'; payload: { id: string; status: Stage } }
  | { type: 'video.check'; payload: { id: string; key: ChecklistKey; value: boolean } }
  | { type: 'video.delete'; payload: { id: string } }
  | { type: 'post.schedule'; payload: { videoId: string; platform: PlatformId; scheduledAt: number } }
  | { type: 'post.reschedule'; payload: { postId: string; scheduledAt: number } }
  | { type: 'post.remove'; payload: { postId: string } }
  | { type: 'post.retry'; payload: { postId: string } }
  | { type: 'post.publishNow'; payload: { postId: string } }
  | { type: 'post.published'; payload: { postId: string; url?: string; publishedAt?: number } }
  | { type: 'post.failed'; payload: { postId: string; error?: string } }
  | { type: 'post.stats'; payload: { postId: string; t?: number; stats: Partial<Stats> } }
  | { type: 'platform.update'; payload: { id: PlatformId; patch: { handle?: string; connected?: boolean; followers?: number } } }
  | { type: 'goals.update'; payload: Partial<Goals> }
  | { type: 'workspace.update'; payload: Partial<Workspace> };

export type ActionType = Action['type'];

export class ActionError extends Error {}

export function applyAction(state: State, action: Action, now = Date.now()): unknown {
  const V = (id: string) => {
    const v = state.videos.find((x) => x.id === id);
    if (!v) throw new ActionError('Video topilmadi: ' + id);
    return v;
  };
  const P = (id: string): { v: Video; p: Post } => {
    for (const v of state.videos) {
      const p = v.posts.find((x) => x.id === id);
      if (p) return { v, p };
    }
    throw new ActionError('Post topilmadi: ' + id);
  };

  switch (action.type) {
    case 'video.create': {
      const a = action.payload;
      const topic = a.topic && TOPICS.includes(a.topic) ? a.topic : TOPICS[0];
      const v: Video = {
        id: 'v' + state.nextId.v++, title: (a.title || 'Nomsiz video').slice(0, 140), topic, format: a.format === 'long' ? 'long' : 'short', duration: Number(a.duration) || 45,
        status: a.status ?? 'idea', createdAt: now, owner: a.owner || 'Sardor', checklist: emptyChecklist(),
        script: { ...emptyScript(topic), hook: a.hook ?? '' }, notes: a.notes ?? '', posts: [],
      };
      state.videos.push(v);
      log(state, now, 'create', `Yangi g‘oya qo‘shildi: “${v.title}”`);
      return v;
    }
    case 'video.update': {
      const { id, patch } = action.payload;
      const v = V(id);
      const { script, ...rest } = patch;
      Object.assign(v, rest);
      if (script) v.script = { ...v.script, ...script };
      return v;
    }
    case 'video.move': {
      const v = V(action.payload.id);
      const from = v.status;
      v.status = action.payload.status;
      if (v.status === 'ready') CHECKLIST.forEach((c) => (v.checklist[c.id] = true));
      log(state, now, 'move', `“${v.title}”: ${stageName(from)} → ${stageName(v.status)}`);
      return v;
    }
    case 'video.check': {
      const { id, key, value } = action.payload;
      const v = V(id);
      v.checklist[key] = !!value;
      if (readiness(v) >= 1 && ['idea', 'script', 'production', 'editing'].includes(v.status)) {
        v.status = v.posts.some((p) => p.status === 'scheduled') ? 'scheduled' : 'ready';
        log(state, now, 'ready', `“${v.title}” 100% tayyor`);
      }
      return v;
    }
    case 'video.delete': {
      const v = V(action.payload.id);
      state.videos = state.videos.filter((x) => x.id !== v.id);
      log(state, now, 'delete', `O‘chirildi: “${v.title}”`);
      return null;
    }
    case 'post.schedule': {
      const { videoId, platform, scheduledAt } = action.payload;
      const v = V(videoId);
      const when = Number(scheduledAt);
      if (!PLATFORM_IDS.includes(platform) || !when) throw new ActionError('Platforma yoki vaqt noto‘g‘ri');
      const p: Post = { id: 'p' + state.nextId.p++, platform, scheduledAt: when, publishedAt: null, status: 'scheduled', model: null, snapshots: [] };
      v.posts.push(p);
      if (v.status === 'ready' || v.status === 'published' || readiness(v) >= 1) v.status = 'scheduled';
      log(state, now, 'schedule', `“${v.title}” → ${pname(platform)}, ${fmtDate(when)} ${fmtTime(when)}`);
      return p;
    }
    case 'post.reschedule': {
      const { v, p } = P(action.payload.postId);
      p.scheduledAt = Number(action.payload.scheduledAt);
      p.status = 'scheduled';
      p.error = null;
      log(state, now, 'schedule', `“${v.title}” (${pname(p.platform)}) vaqti o‘zgardi: ${fmtDate(p.scheduledAt)} ${fmtTime(p.scheduledAt)}`);
      return p;
    }
    case 'post.remove': {
      const { v, p } = P(action.payload.postId);
      v.posts = v.posts.filter((x) => x.id !== p.id);
      if (v.status === 'scheduled' && !v.posts.some((x) => x.status === 'scheduled')) v.status = readiness(v) >= 1 ? 'ready' : 'editing';
      return null;
    }
    case 'post.retry': {
      const { v, p } = P(action.payload.postId);
      p.status = 'scheduled';
      p.error = null;
      p.scheduledAt = now + 15 * 60e3;
      if (v.status === 'published') v.status = 'scheduled';
      log(state, now, 'schedule', `Qayta urinish: “${v.title}” → ${pname(p.platform)} (15 daqiqadan so‘ng)`);
      return p;
    }
    case 'post.publishNow': {
      const { v, p } = P(action.payload.postId);
      p.scheduledAt = now - 1000;
      CHECKLIST.forEach((c) => (v.checklist[c.id] = true));
      const prev = state.workspace.autoPublish;
      state.workspace.autoPublish = true; // qo'lda "hozir joylash" simulyatsiyadan qat'i nazar ishlaydi
      tick(state, now);
      state.workspace.autoPublish = prev;
      return p;
    }
    case 'post.published': {
      const { v, p } = P(action.payload.postId);
      p.status = 'published';
      p.publishedAt = Number(action.payload.publishedAt) || now;
      p.url = action.payload.url ?? p.url;
      p.error = null;
      p.model = null;
      if (v.posts.every((x) => x.status !== 'scheduled')) v.status = 'published';
      log(state, now, 'publish', `“${v.title}” ${pname(p.platform)}’ga joylandi (worker)`);
      return p;
    }
    case 'post.failed': {
      const { v, p } = P(action.payload.postId);
      p.status = 'failed';
      p.error = action.payload.error ?? 'Noma’lum xato';
      log(state, now, 'warning', `${pname(p.platform)} xatosi: “${v.title}” — ${p.error}`);
      return p;
    }
    case 'post.stats': {
      const { p } = P(action.payload.postId);
      const s = action.payload.stats ?? {};
      const snap: Post['snapshots'][number] = { t: Number(action.payload.t) || now };
      for (const k of ['views', 'likes', 'comments', 'shares', 'saves', 'subs', 'retention', 'ctr'] as const) if (s[k] != null) snap[k] = Number(s[k]);
      if (!p.snapshots.length && p.publishedAt) p.snapshots = [{ t: p.publishedAt, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, subs: 0, retention: 0 }];
      p.snapshots.push(snap);
      p.model = null;
      return p;
    }
    case 'platform.update': {
      const { id, patch } = action.payload;
      const pl = state.platforms.find((x) => x.id === id);
      if (!pl) throw new ActionError('Platforma topilmadi');
      if (patch.handle != null) pl.handle = patch.handle;
      if (patch.connected != null) {
        pl.connected = patch.connected;
        if (patch.connected) {
          pl.tokenExpiresAt = pl.id === 'telegram' ? null : now + 60 * 24 * 3600e3; // bot tokeni muddatsiz
          log(state, now, 'connect', `${pname(pl.id)} qayta ulandi`);
        }
      }
      if (patch.followers != null) pl.manualDelta = (pl.manualDelta ?? 0) + Number(patch.followers) - followersAt(state, pl.id, now);
      return pl;
    }
    case 'goals.update': {
      const g = action.payload;
      for (const k of ['monthlySubs', 'monthlyViews', 'weeklyVideos'] as const) if (g[k] != null) state.goals[k] = Math.max(0, Number(g[k]) || 0);
      return state.goals;
    }
    case 'workspace.update': {
      const w = action.payload;
      if (w.name != null) state.workspace.name = String(w.name).slice(0, 40) || 'Kontent Zavod';
      if (w.autoPublish != null) state.workspace.autoPublish = !!w.autoPublish;
      return state.workspace;
    }
    default:
      throw new ActionError('Noma’lum amal: ' + (action as { type: string }).type);
  }
}
