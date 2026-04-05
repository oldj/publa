CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"storage_provider" text NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" integer,
	"created_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "captchas" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"text" text NOT NULL,
	"expires_at" text NOT NULL,
	CONSTRAINT "captchas_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_id" integer NOT NULL,
	"parent_id" integer,
	"user_id" integer,
	"author_name" text NOT NULL,
	"author_email" text,
	"author_website" text,
	"content" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"moderated_by" integer,
	"moderated_at" text,
	"created_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"content_type" text DEFAULT 'html' NOT NULL,
	"content_raw" text DEFAULT '' NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"content_text" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_tags" (
	"content_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	CONSTRAINT "content_tags_content_id_tag_id_pk" PRIMARY KEY("content_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "contents" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"slug" text,
	"author_id" integer,
	"content_text" text DEFAULT '' NOT NULL,
	"excerpt" text,
	"excerpt_auto" text,
	"category_id" integer,
	"cover_image_id" integer,
	"allow_comment" boolean DEFAULT true NOT NULL,
	"show_comments" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"path" text,
	"template" text,
	"content_type" text DEFAULT 'html' NOT NULL,
	"content_raw" text DEFAULT '' NOT NULL,
	"content_html" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"canonical_url" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"published_at" text,
	"deleted_at" text,
	CONSTRAINT "contents_slug_unique" UNIQUE("slug"),
	CONSTRAINT "contents_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "guestbook_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_name" text NOT NULL,
	"author_email" text,
	"author_website" text,
	"content" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"status" text DEFAULT 'unread' NOT NULL,
	"created_at" text NOT NULL,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "menus" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"parent_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"target" text DEFAULT '_self' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"identifier" text NOT NULL,
	"ip_address" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_histories" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_id" integer NOT NULL,
	"slug" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"seo_title" text,
	"seo_description" text,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"avatar_url" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_moderated_by_users_id_fk" FOREIGN KEY ("moderated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_tags" ADD CONSTRAINT "content_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contents" ADD CONSTRAINT "contents_cover_image_id_attachments_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menus" ADD CONSTRAINT "menus_parent_id_menus_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menus"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slug_histories" ADD CONSTRAINT "slug_histories_content_id_contents_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."contents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_storage_key_idx" ON "attachments" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "comments_content_status_deleted_created_idx" ON "comments" USING btree ("content_id","status","deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "comments_deleted_status_created_idx" ON "comments" USING btree ("deleted_at","status","created_at" desc);--> statement-breakpoint
CREATE INDEX "comments_author_email_deleted_status_idx" ON "comments" USING btree ("author_email","deleted_at","status");--> statement-breakpoint
CREATE INDEX "content_revisions_target_status_updated_at_idx" ON "content_revisions" USING btree ("target_type","target_id","status","updated_at" desc);--> statement-breakpoint
CREATE INDEX "content_tags_tag_content_idx" ON "content_tags" USING btree ("tag_id","content_id");--> statement-breakpoint
CREATE INDEX "contents_type_deleted_pinned_published_created_idx" ON "contents" USING btree ("type","deleted_at","pinned" desc,"published_at" desc,"created_at" desc);--> statement-breakpoint
CREATE INDEX "contents_type_status_deleted_published_idx" ON "contents" USING btree ("type","status","deleted_at","published_at" desc);--> statement-breakpoint
CREATE INDEX "contents_type_status_deleted_pinned_published_idx" ON "contents" USING btree ("type","status","deleted_at","pinned" desc,"published_at" desc);--> statement-breakpoint
CREATE INDEX "contents_categoryid_idx" ON "contents" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "rate_events_type_identifier_created_idx" ON "rate_events" USING btree ("event_type","identifier","created_at");--> statement-breakpoint
CREATE INDEX "rate_events_created_idx" ON "rate_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "slug_histories_slug_idx" ON "slug_histories" USING btree ("slug");