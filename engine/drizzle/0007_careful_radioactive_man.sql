ALTER TYPE "public"."revision_entity" ADD VALUE 'saved_block';--> statement-breakpoint
CREATE TABLE "saved_block_usage" (
	"saved_block_id" uuid NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"content_id" varchar(120) NOT NULL,
	CONSTRAINT "saved_block_usage_saved_block_id_content_type_content_id_pk" PRIMARY KEY("saved_block_id","content_type","content_id")
);
--> statement-breakpoint
CREATE TABLE "saved_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(300) DEFAULT '' NOT NULL,
	"category" varchar(60) DEFAULT '' NOT NULL,
	"mode" varchar(10) DEFAULT 'synced' NOT NULL,
	"tree" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"locale" varchar(5) DEFAULT 'en' NOT NULL,
	"translation_group_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"created_by_id" uuid,
	"updated_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "saved_block_usage" ADD CONSTRAINT "saved_block_usage_saved_block_id_saved_blocks_id_fk" FOREIGN KEY ("saved_block_id") REFERENCES "public"."saved_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_blocks" ADD CONSTRAINT "saved_blocks_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_blocks" ADD CONSTRAINT "saved_blocks_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "saved_block_usage_content_idx" ON "saved_block_usage" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "saved_blocks_translation_idx" ON "saved_blocks" USING btree ("translation_group_id");