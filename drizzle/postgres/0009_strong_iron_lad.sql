ALTER TABLE "categories" ADD COLUMN "post_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tags" ADD COLUMN "post_count" integer DEFAULT 0 NOT NULL;