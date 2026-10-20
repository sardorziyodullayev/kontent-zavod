CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`t` integer NOT NULL,
	`type` text NOT NULL,
	`text` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `platforms` (
	`id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`base` integer NOT NULL,
	`connected` integer NOT NULL,
	`token_expires_at` integer,
	`organic_per_day` real NOT NULL,
	`since` integer NOT NULL,
	`manual_delta` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`ord` integer NOT NULL,
	`video_id` text NOT NULL,
	`platform` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`published_at` integer,
	`status` text NOT NULL,
	`url` text,
	`error` text,
	`model` text,
	`snapshots` text NOT NULL,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `posts_video_idx` ON `posts` (`video_id`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`ord` integer NOT NULL,
	`title` text NOT NULL,
	`topic` text NOT NULL,
	`format` text NOT NULL,
	`duration` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`owner` text NOT NULL,
	`checklist` text NOT NULL,
	`script` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`viral` integer DEFAULT false NOT NULL
);
