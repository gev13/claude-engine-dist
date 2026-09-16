CREATE TYPE "public"."application_status" AS ENUM('new', 'read', 'shortlisted', 'rejected');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"job_title" varchar(300) DEFAULT '' NOT NULL,
	"name" varchar(200) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(60) DEFAULT '' NOT NULL,
	"cover_letter" text DEFAULT '' NOT NULL,
	"cv_filename" varchar(80),
	"cv_original_name" varchar(160) DEFAULT '' NOT NULL,
	"cv_bytes" integer DEFAULT 0 NOT NULL,
	"status" "application_status" DEFAULT 'new' NOT NULL,
	"ip" varchar(64),
	"user_agent" varchar(400),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(200) NOT NULL,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"translation_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(300) NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"location" varchar(160) DEFAULT '' NOT NULL,
	"contract_type" varchar(120) DEFAULT '' NOT NULL,
	"working_time" varchar(120) DEFAULT '' NOT NULL,
	"seniority" varchar(120) DEFAULT '' NOT NULL,
	"workweek" varchar(120) DEFAULT '' NOT NULL,
	"department" varchar(160) DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"responsibilities" text DEFAULT '' NOT NULL,
	"benefits" text DEFAULT '' NOT NULL,
	"cover_media_id" uuid,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"posted_at" timestamp with time zone,
	"deadline" timestamp with time zone,
	"is_open" boolean DEFAULT true NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"author_id" uuid,
	"deleted_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "applications_job_idx" ON "applications" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "applications_created_idx" ON "applications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_slug_key" ON "jobs" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "jobs_translation_idx" ON "jobs" USING btree ("translation_group_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "jobs_open_idx" ON "jobs" USING btree ("is_open");