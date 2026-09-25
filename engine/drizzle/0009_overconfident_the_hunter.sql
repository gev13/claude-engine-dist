ALTER TABLE "media" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "variants" jsonb DEFAULT '[]'::jsonb NOT NULL;