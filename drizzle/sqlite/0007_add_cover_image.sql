PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `contents_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`slug` text,
	`author_id` integer,
	`content_text` text DEFAULT '' NOT NULL,
	`excerpt` text,
	`excerpt_auto` text,
	`category_id` integer,
	`cover_image` text,
	`allow_comment` integer DEFAULT true NOT NULL,
	`show_comments` integer DEFAULT true NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`path` text,
	`template` text,
	`content_type` text DEFAULT 'richtext' NOT NULL,
	`content_raw` text DEFAULT '' NOT NULL,
	`content_html` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`canonical_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`published_at` text,
	`deleted_at` text,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `contents_new` (`id`, `type`, `title`, `slug`, `author_id`, `content_text`, `excerpt`, `excerpt_auto`, `category_id`, `cover_image`, `allow_comment`, `show_comments`, `view_count`, `pinned`, `path`, `template`, `content_type`, `content_raw`, `content_html`, `status`, `seo_title`, `seo_description`, `canonical_url`, `created_at`, `updated_at`, `published_at`, `deleted_at`) SELECT `id`, `type`, `title`, `slug`, `author_id`, `content_text`, `excerpt`, `excerpt_auto`, `category_id`, NULL, `allow_comment`, `show_comments`, `view_count`, `pinned`, `path`, `template`, `content_type`, `content_raw`, `content_html`, `status`, `seo_title`, `seo_description`, `canonical_url`, `created_at`, `updated_at`, `published_at`, `deleted_at` FROM `contents`;--> statement-breakpoint
DROP TABLE `contents`;--> statement-breakpoint
ALTER TABLE `contents_new` RENAME TO `contents`;--> statement-breakpoint
CREATE UNIQUE INDEX `contents_slug_unique` ON `contents` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `contents_path_unique` ON `contents` (`path`);--> statement-breakpoint
CREATE INDEX `contents_type_deleted_pinned_published_created_idx` ON `contents` (`type`,`deleted_at`,"pinned" desc,"published_at" desc,"created_at" desc);--> statement-breakpoint
CREATE INDEX `contents_type_status_deleted_published_idx` ON `contents` (`type`,`status`,`deleted_at`,"published_at" desc);--> statement-breakpoint
CREATE INDEX `contents_type_status_deleted_pinned_published_idx` ON `contents` (`type`,`status`,`deleted_at`,"pinned" desc,"published_at" desc);--> statement-breakpoint
CREATE INDEX `contents_categoryid_idx` ON `contents` (`category_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
