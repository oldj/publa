CREATE TABLE "email_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"recipients" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"error_message" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_logs_created_idx" ON "email_logs" USING btree ("created_at" desc);