ALTER TYPE "public"."revision_entity" ADD VALUE 'project';--> statement-breakpoint
CREATE TABLE "project_term_links" (
	"project_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "project_term_links_project_id_term_id_pk" PRIMARY KEY("project_id","term_id")
);
--> statement-breakpoint
CREATE TABLE "project_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taxonomy" varchar(10) NOT NULL,
	"slug" varchar(200) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"translation_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(200) NOT NULL,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"translation_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(300) NOT NULL,
	"summary" varchar(300) DEFAULT '' NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	"cover_media_id" uuid,
	"hover_media_id" uuid,
	"hero_media_id" uuid,
	"client" varchar(200) DEFAULT '' NOT NULL,
	"year" varchar(20) DEFAULT '' NOT NULL,
	"url" varchar(500) DEFAULT '' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_css" text DEFAULT '' NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"author_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_term_links" ADD CONSTRAINT "project_term_links_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_term_links" ADD CONSTRAINT "project_term_links_term_id_project_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."project_terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_hover_media_id_media_id_fk" FOREIGN KEY ("hover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_term_links_term_idx" ON "project_term_links" USING btree ("term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_terms_slug_key" ON "project_terms" USING btree ("locale","taxonomy","slug");--> statement-breakpoint
CREATE INDEX "project_terms_translation_idx" ON "project_terms" USING btree ("translation_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_key" ON "projects" USING btree ("locale","slug");--> statement-breakpoint
CREATE INDEX "projects_translation_idx" ON "projects" USING btree ("translation_group_id");--> statement-breakpoint
CREATE INDEX "projects_status_published_idx" ON "projects" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "projects_featured_idx" ON "projects" USING btree ("featured");