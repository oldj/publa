ALTER TABLE `users` ADD `token_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `rate_events_type_ip_created_idx` ON `rate_events` (`event_type`,`ip_address`,`created_at`);