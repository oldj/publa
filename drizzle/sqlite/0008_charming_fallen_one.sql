CREATE TABLE `activity_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`action` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_logs_user_created_idx` ON `activity_logs` (`user_id`,"created_at" desc);--> statement-breakpoint
CREATE INDEX `activity_logs_created_idx` ON `activity_logs` ("created_at" desc);