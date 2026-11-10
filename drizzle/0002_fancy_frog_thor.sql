CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_id` integer NOT NULL,
	`title` text NOT NULL,
	`direction` text DEFAULT '' NOT NULL,
	`style` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`script` text DEFAULT '' NOT NULL,
	`video_url` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`deadline` integer,
	`created_at` integer NOT NULL,
	`done_at` integer,
	`created_by` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'panel' NOT NULL,
	`files` text DEFAULT '[]' NOT NULL,
	`log` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`period_id`) REFERENCES `periods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `orders_period_idx` ON `orders` (`period_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`period_id` integer NOT NULL,
	`amount` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`period_id`) REFERENCES `periods`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `periods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`login` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`pass_hash` text NOT NULL,
	`ver` integer DEFAULT 1 NOT NULL,
	`tg_id` text,
	`link_code` text,
	`link_exp` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_login_unique` ON `users` (`login`);