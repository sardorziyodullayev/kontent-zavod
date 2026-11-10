ALTER TABLE `payments` ADD `created_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments` ADD `confirmed_at` integer;--> statement-breakpoint
UPDATE `payments` SET `confirmed_at` = `id` WHERE `confirmed_at` IS NULL;