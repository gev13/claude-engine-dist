CREATE TABLE "consent_stats" (
	"day" varchar(10) NOT NULL,
	"choice" varchar(10) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "consent_stats_day_choice_pk" PRIMARY KEY("day","choice")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" varchar(36) NOT NULL,
	"webhook_name" varchar(80) NOT NULL,
	"event" varchar(40) NOT NULL,
	"target_id" uuid,
	"status" varchar(10) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"response_code" integer,
	"error" varchar(300),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_submissions" ADD COLUMN "meta" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "webhook_deliveries_created_idx" ON "webhook_deliveries" USING btree ("created_at");