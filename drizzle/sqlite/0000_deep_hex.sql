CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`filename` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`storage_provider` text NOT NULL,
	`storage_key` text NOT NULL,
	`uploaded_by` integer,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attachments_storage_key_idx` ON `attachments` (`storage_key`);--> statement-breakpoint
CREATE TABLE `captchas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` text NOT NULL,
	`text` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `captchas_session_id_unique` ON `captchas` (`session_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`seo_title` text,
	`seo_description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_id` integer NOT NULL,
	`parent_id` integer,
	`user_id` integer,
	`author_name` text NOT NULL,
	`author_email` text,
	`author_website` text,
	`content` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`moderated_by` integer,
	`moderated_at` text,
	`created_at` text NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`moderated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `comments_content_status_deleted_created_idx` ON `comments` (`content_id`,`status`,`deleted_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_deleted_status_created_idx` ON `comments` (`deleted_at`,`status`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `comments_author_email_deleted_status_idx` ON `comments` (`author_email`,`deleted_at`,`status`);--> statement-breakpoint
CREATE TABLE `content_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`target_type` text NOT NULL,
	`target_id` integer NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`content_type` text DEFAULT 'html' NOT NULL,
	`content_raw` text DEFAULT '' NOT NULL,
	`content_html` text DEFAULT '' NOT NULL,
	`content_text` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `content_revisions_target_status_updated_at_idx` ON `content_revisions` (`target_type`,`target_id`,`status`,"updated_at" desc);--> statement-breakpoint
CREATE TABLE `content_tags` (
	`content_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`content_id`, `tag_id`),
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `content_tags_tag_content_idx` ON `content_tags` (`tag_id`,`content_id`);--> statement-breakpoint
CREATE TABLE `contents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`slug` text,
	`author_id` integer,
	`content_text` text DEFAULT '' NOT NULL,
	`excerpt` text,
	`excerpt_auto` text,
	`category_id` integer,
	`cover_image_id` integer,
	`allow_comment` integer DEFAULT true NOT NULL,
	`show_comments` integer DEFAULT true NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`path` text,
	`template` text,
	`content_type` text DEFAULT 'html' NOT NULL,
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
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cover_image_id`) REFERENCES `attachments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contents_slug_unique` ON `contents` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `contents_path_unique` ON `contents` (`path`);--> statement-breakpoint
CREATE INDEX `contents_type_deleted_pinned_published_created_idx` ON `contents` (`type`,`deleted_at`,"pinned" desc,"published_at" desc,"created_at" desc);--> statement-breakpoint
CREATE INDEX `contents_type_status_deleted_published_idx` ON `contents` (`type`,`status`,`deleted_at`,"published_at" desc);--> statement-breakpoint
CREATE INDEX `contents_type_status_deleted_pinned_published_idx` ON `contents` (`type`,`status`,`deleted_at`,"pinned" desc,"published_at" desc);--> statement-breakpoint
CREATE INDEX `contents_categoryid_idx` ON `contents` (`category_id`);--> statement-breakpoint
CREATE TABLE `guestbook_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`author_name` text NOT NULL,
	`author_email` text,
	`author_website` text,
	`content` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`status` text DEFAULT 'unread' NOT NULL,
	`created_at` text NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`parent_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`target` text DEFAULT '_self' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rate_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_type` text NOT NULL,
	`identifier` text NOT NULL,
	`ip_address` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_events_type_identifier_created_idx` ON `rate_events` (`event_type`,`identifier`,`created_at`);--> statement-breakpoint
CREATE INDEX `rate_events_created_idx` ON `rate_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `slug_histories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`content_id` integer NOT NULL,
	`slug` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `slug_histories_slug_idx` ON `slug_histories` (`slug`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`seo_title` text,
	`seo_description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`avatar_url` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);