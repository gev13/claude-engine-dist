ALTER TYPE "public"."user_role" ADD VALUE 'manager' BEFORE 'editor';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'author';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'reviewer';