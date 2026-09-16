DROP INDEX "categories_slug_key";--> statement-breakpoint
DROP INDEX "pages_path_key";--> statement-breakpoint
DROP INDEX "posts_slug_key";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "locale" varchar(5) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "translation_group_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "locale" varchar(5) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "translation_group_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "locale" varchar(5) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "translation_group_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE INDEX "categories_translation_idx" ON "categories" USING btree ("translation_group_id");--> statement-breakpoint
CREATE INDEX "pages_translation_idx" ON "pages" USING btree ("translation_group_id");--> statement-breakpoint
CREATE INDEX "posts_translation_idx" ON "posts" USING btree ("translation_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("locale","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_path_key" ON "pages" USING btree ("locale","path");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_key" ON "posts" USING btree ("locale","slug");