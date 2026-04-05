CREATE TABLE "redirect_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"path_regex" text NOT NULL,
	"redirect_to" text NOT NULL,
	"redirect_type" text DEFAULT '301' NOT NULL,
	"memo" text
);
--> statement-breakpoint
ALTER TABLE "content_revisions" ALTER COLUMN "content_type" SET DEFAULT 'richtext';--> statement-breakpoint
ALTER TABLE "contents" ALTER COLUMN "content_type" SET DEFAULT 'richtext';--> statement-breakpoint
CREATE INDEX "redirect_rules_sort_order_idx" ON "redirect_rules" USING btree ("sort_order","id");