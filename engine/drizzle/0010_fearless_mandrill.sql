ALTER TABLE "categories" ADD COLUMN "image_url" varchar(500);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" varchar(500);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;