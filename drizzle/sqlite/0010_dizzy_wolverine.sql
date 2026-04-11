ALTER TABLE `categories` ADD `post_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tags` ADD `post_count` integer DEFAULT 0 NOT NULL;