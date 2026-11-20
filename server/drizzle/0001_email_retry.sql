ALTER TABLE "duty_change" ADD COLUMN "email_next_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "duty_change" ADD COLUMN "email_error" text;