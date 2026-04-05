DROP INDEX "attachments_storage_key_idx";--> statement-breakpoint
DROP INDEX "captchas_session_id_unique";--> statement-breakpoint
DROP INDEX "categories_slug_unique";--> statement-breakpoint
DROP INDEX "comments_content_status_deleted_created_idx";--> statement-breakpoint
DROP INDEX "comments_deleted_status_created_idx";--> statement-breakpoint
DROP INDEX "comments_author_email_deleted_status_idx";--> statement-breakpoint
DROP INDEX "content_revisions_target_status_updated_at_idx";--> statement-breakpoint
DROP INDEX "content_tags_tag_content_idx";--> statement-breakpoint
DROP INDEX "contents_slug_unique";--> statement-breakpoint
DROP INDEX "contents_path_unique";--> statement-breakpoint
DROP INDEX "contents_type_deleted_pinned_published_created_idx";--> statement-breakpoint
DROP INDEX "contents_type_status_deleted_published_idx";--> statement-breakpoint
DROP INDEX "contents_type_status_deleted_pinned_published_idx";--> statement-breakpoint
DROP INDEX "contents_categoryid_idx";--> statement-breakpoint
DROP INDEX "rate_events_type_identifier_created_idx";--> statement-breakpoint
DROP INDEX "rate_events_created_idx";--> statement-breakpoint
DROP INDEX "slug_histories_slug_idx";--> statement-breakpoint
DROP INDEX "tags_slug_unique";--> statement-breakpoint
DROP INDEX "users_username_unique";--> statement-breakpoint
ALTER TABLE `content_revisions` ALTER COLUMN "content_type" TO "content_type" text NOT NULL DEFAULT 'richtext';--> statement-breakpoint
CREATE INDEX `attachments_storage_key_idx` ON `attachments` (`storage_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `captchas_session_id_unique` ON `captchas` (`session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `comments_content_status_deleted_created_idx` ON `comments` (`content_id`,`status`,`deleted_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_deleted_status_created_idx` ON `comments` (`deleted_at`,`status`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `comments_author_email_deleted_status_idx` ON `comments` (`author_email`,`deleted_at`,`status`);--> statement-breakpoint
CREATE INDEX `content_revisions_target_status_updated_at_idx` ON `content_revisions` (`target_type`,`target_id`,`status`,"updated_at" desc);--> statement-breakpoint
CREATE INDEX `content_tags_tag_content_idx` ON `content_tags` (`tag_id`,`content_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `contents_slug_unique` ON `contents` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `contents_path_unique` ON `contents` (`path`);--> statement-breakpoint
CREATE INDEX `contents_type_deleted_pinned_published_created_idx` ON `contents` (`type`,`deleted_at`,"pinned" desc,"published_at" desc,"created_at" desc);--> statement-breakpoint
CREATE INDEX `contents_type_status_deleted_published_idx` ON `contents` (`type`,`status`,`deleted_at`,"published_at" desc);--> statement-breakpoint
CREATE INDEX `contents_type_status_deleted_pinned_published_idx` ON `contents` (`type`,`status`,`deleted_at`,"pinned" desc,"published_at" desc);--> statement-breakpoint
CREATE INDEX `contents_categoryid_idx` ON `contents` (`category_id`);--> statement-breakpoint
CREATE INDEX `rate_events_type_identifier_created_idx` ON `rate_events` (`event_type`,`identifier`,`created_at`);--> statement-breakpoint
CREATE INDEX `rate_events_created_idx` ON `rate_events` (`created_at`);--> statement-breakpoint
CREATE INDEX `slug_histories_slug_idx` ON `slug_histories` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
ALTER TABLE `contents` ALTER COLUMN "content_type" TO "content_type" text NOT NULL DEFAULT 'richtext';