import { blob, index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ChecklistKey, GrowthModel, Script, Snapshot } from '../src/core/types';

export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(),
  ord: integer('ord').notNull(),
  title: text('title').notNull(),
  topic: text('topic').notNull(),
  format: text('format', { enum: ['short', 'long'] }).notNull(),
  duration: integer('duration').notNull(),
  status: text('status', { enum: ['idea', 'script', 'production', 'editing', 'ready', 'scheduled', 'published'] }).notNull(),
  createdAt: integer('created_at').notNull(),
  owner: text('owner').notNull(),
  checklist: text('checklist', { mode: 'json' }).$type<Record<ChecklistKey, boolean>>().notNull(),
  script: text('script', { mode: 'json' }).$type<Script>().notNull(),
  notes: text('notes').notNull().default(''),
  viral: integer('viral', { mode: 'boolean' }).notNull().default(false),
});

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    ord: integer('ord').notNull(),
    videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
    platform: text('platform', { enum: ['youtube', 'instagram', 'tiktok', 'telegram', 'facebook'] }).notNull(),
    scheduledAt: integer('scheduled_at').notNull(),
    publishedAt: integer('published_at'),
    status: text('status', { enum: ['scheduled', 'published', 'failed', 'missed'] }).notNull(),
    url: text('url'),
    error: text('error'),
    model: text('model', { mode: 'json' }).$type<GrowthModel | null>(),
    snapshots: text('snapshots', { mode: 'json' }).$type<Snapshot[]>().notNull(),
  },
  (t) => [index('posts_video_idx').on(t.videoId), index('posts_status_idx').on(t.status, t.scheduledAt)],
);

export const platforms = sqliteTable('platforms', {
  id: text('id', { enum: ['youtube', 'instagram', 'tiktok', 'telegram', 'facebook'] }).primaryKey(),
  handle: text('handle').notNull(),
  base: integer('base').notNull(),
  connected: integer('connected', { mode: 'boolean' }).notNull(),
  tokenExpiresAt: integer('token_expires_at'),
  organicPerDay: real('organic_per_day').notNull(),
  since: integer('since').notNull(),
  manualDelta: real('manual_delta').notNull().default(0),
});

export const activity = sqliteTable('activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  t: integer('t').notNull(),
  type: text('type').notNull(),
  text: text('text').notNull(),
});

/** workspace, goals, nextId, seededAt kabi bitta qiymatli sozlamalar */
export const meta = sqliteTable('meta', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
});

/** Disk o'chib ketadigan hosting (Render free) uchun: media va worker fayllarining bazadagi nusxasi, 1 MB lik bo'laklarda */
export const files = sqliteTable(
  'files',
  {
    path: text('path').notNull(),
    idx: integer('idx').notNull(),
    data: blob('data', { mode: 'buffer' }).notNull(),
    mtime: integer('mtime').notNull(),
  },
  (t) => [primaryKey({ columns: [t.path, t.idx] })],
);
