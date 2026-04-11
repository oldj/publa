CREATE TABLE "custom_styles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"css" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"builtin_key" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
