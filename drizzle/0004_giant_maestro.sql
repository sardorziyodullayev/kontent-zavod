ALTER TABLE `users` ADD `lang` text DEFAULT 'uz' NOT NULL;--> statement-breakpoint
UPDATE `users` SET `lang` = 'ru' WHERE `role` = 'client';