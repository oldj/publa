ALTER TABLE "contents" ADD COLUMN "cover_image" text;--> statement-breakpoint
ALTER TABLE "contents" DROP CONSTRAINT "contents_cover_image_id_attachments_id_fk";--> statement-breakpoint
ALTER TABLE "contents" DROP COLUMN IF EXISTS "cover_image_id";
