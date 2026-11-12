ALTER TABLE `orders` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `must_change` integer DEFAULT false NOT NULL;