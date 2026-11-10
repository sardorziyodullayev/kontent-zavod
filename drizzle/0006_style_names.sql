-- Uslub nomlari: Multfilm → 2D animatsiya, Real → Realistik, Moushn → Motion
UPDATE `orders` SET `style` = '2D animatsiya' WHERE `style` = 'Multfilm';--> statement-breakpoint
UPDATE `orders` SET `style` = 'Realistik' WHERE `style` = 'Real';--> statement-breakpoint
UPDATE `orders` SET `style` = 'Motion' WHERE `style` = 'Moushn';
