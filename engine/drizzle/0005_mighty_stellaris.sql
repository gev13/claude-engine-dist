DROP INDEX "redirect_from_idx";--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "layout" varchar(20) DEFAULT 'body' NOT NULL;--> statement-breakpoint
ALTER TABLE "redirects" ADD COLUMN "match_type" varchar(10) DEFAULT 'exact' NOT NULL;--> statement-breakpoint
ALTER TABLE "redirects" ADD COLUMN "match_query" varchar(300) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "redirects" ADD COLUMN "keep_rest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "redirect_from_idx" ON "redirects" USING btree ("from_path","match_type","match_query");