ALTER TABLE "pages" ADD COLUMN "appearance" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "appearance" jsonb DEFAULT '{}'::jsonb NOT NULL;