CREATE TABLE `content_daily_views` (
	`date` text NOT NULL,
	`content_id` integer NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`date`, `content_id`)
);
--> statement-breakpoint
CREATE INDEX `content_daily_views_content_date_idx` ON `content_daily_views` (`content_id`,"date" desc);