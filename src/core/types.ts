export type PlatformId = 'youtube' | 'instagram' | 'tiktok' | 'telegram' | 'facebook';
export type Stage = 'idea' | 'script' | 'production' | 'editing' | 'ready' | 'scheduled' | 'published';
export type PostStatus = 'scheduled' | 'published' | 'failed' | 'missed';
export type Format = 'short' | 'long';
export type ChecklistKey = 'script' | 'voice' | 'footage' | 'edit' | 'thumbnail' | 'subtitles' | 'caption' | 'approved';

export interface Stats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  subs: number;
  retention: number;
  ctr: number | null;
}

export interface Snapshot extends Partial<Stats> {
  t: number;
}

/** Simulyatsiya modeli: ko'rishlar V*(1-e^(-t/tau)) bo'yicha o'sadi. */
export interface GrowthModel {
  V: number;
  tau: number;
  like: number;
  comment: number;
  share: number;
  save: number;
  subs: number;
  ret: number;
  ctr: number | null;
}

export interface Post {
  id: string;
  platform: PlatformId;
  scheduledAt: number;
  publishedAt: number | null;
  status: PostStatus;
  url?: string;
  error?: string | null;
  model: GrowthModel | null;
  snapshots: Snapshot[];
}

export interface Script {
  template: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  description: string;
}

export interface Video {
  id: string;
  title: string;
  topic: string;
  format: Format;
  duration: number;
  status: Stage;
  createdAt: number;
  owner: string;
  checklist: Record<ChecklistKey, boolean>;
  script: Script;
  notes: string;
  posts: Post[];
  viral?: boolean;
}

export interface Platform {
  id: PlatformId;
  handle: string;
  base: number;
  connected: boolean;
  tokenExpiresAt: number | null;
  organicPerDay: number;
  since: number;
  manualDelta?: number;
}

export interface Activity {
  t: number;
  type: string;
  text: string;
}

export interface Goals {
  monthlySubs: number;
  monthlyViews: number;
  weeklyVideos: number;
}

export interface Workspace {
  name: string;
  timezone: string;
  autoPublish: boolean;
}

export interface State {
  version: 1;
  seededAt: number;
  updatedAt?: number;
  nextId: { v: number; p: number };
  workspace: Workspace;
  goals: Goals;
  platforms: Platform[];
  videos: Video[];
  activity: Activity[];
}

export interface Forecast {
  mid: number;
  lo: number;
  hi: number;
  subs: number;
  subsLo: number;
  subsHi: number;
  er: number;
  n: number;
  confidence: 'yuqori' | 'o‘rta' | 'past';
  factors: { soat: number; kun: number; mavzu: number };
}

export type AlertLevel = 'critical' | 'serious' | 'warning' | 'good';
export interface Alert {
  level: AlertLevel;
  title: string;
  text: string;
  t: number;
  videoId?: string;
  postId?: string;
  platformId?: PlatformId;
  action?: 'retry' | 'plan';
}

export interface Insight {
  kind: 'time' | 'topic' | 'subs' | 'format' | 'hook' | 'cadence';
  text: string;
  platform?: PlatformId;
}

export interface QueueItem {
  postId: string;
  videoId: string;
  title: string;
  platform: PlatformId;
  scheduledAt: number;
  ready: boolean;
  readiness: number;
  caption: string;
  hashtags: string;
  format: Format;
  dueIn: number;
}
