CREATE TABLE `redirect_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`path_regex` text NOT NULL,
	`redirect_to` text NOT NULL,
	`redirect_type` text DEFAULT '301' NOT NULL,
	`memo` text
);
--> statement-breakpoint
CREATE INDEX `redirect_rules_sort_order_idx` ON `redirect_rules` (`sort_order`,`id`);