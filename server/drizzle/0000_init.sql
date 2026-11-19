CREATE TYPE "public"."auth_token_kind" AS ENUM('code', 'session');--> statement-breakpoint
CREATE TYPE "public"."course" AS ENUM('DAAA', 'DCDF', 'DCS', 'DCITP', 'Other');--> statement-breakpoint
CREATE TYPE "public"."duty_change_kind" AS ENUM('assignment', 'break', 'timing');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('pending', 'sent', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."footfall_variant" AS ENUM('entry', 'guided', 'walk_in');--> statement-breakpoint
CREATE TYPE "public"."gift_movement_kind" AS ENUM('initial', 'redeem', 'restock', 'correct', 'transfer_in', 'transfer_out');--> statement-breakpoint
CREATE TYPE "public"."rank" AS ENUM('cc', 'deputy', 'shadow_ic', 'ic', 'volunteer');--> statement-breakpoint
CREATE TYPE "public"."reg_category" AS ENUM('sec1', 'sec2', 'sec3', 'sec4', 'sec5', 'graduated', 'parent', 'other');--> statement-breakpoint
CREATE TYPE "public"."station_kind" AS ENUM('staffed', 'registration', 'counting', 'counselling');--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"course" "course",
	"rank" "rank" NOT NULL,
	"team" text,
	"portfolio" text,
	"available_day_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_day" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"report_time" time,
	"dismiss_time" time,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_day_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "station" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"room" text DEFAULT '' NOT NULL,
	"kind" "station_kind" NOT NULL,
	"team" text,
	"capacity" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "station_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"day_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "break_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"day_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"label" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "break_period_ends_after_start" CHECK ("break_period"."ends_at" > "break_period"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "duty_change" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"day_id" uuid,
	"kind" "duty_change_kind" NOT NULL,
	"summary" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"email_status" "email_status" DEFAULT 'pending' NOT NULL,
	"email_attempts" integer DEFAULT 0 NOT NULL,
	"emailed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "footfall" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"variant" "footfall_variant" DEFAULT 'entry' NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"course" "course",
	"recorded_by" uuid,
	"device_id" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	CONSTRAINT "footfall_client_id_unique" UNIQUE("client_id"),
	CONSTRAINT "footfall_count_positive" CHECK ("footfall"."count" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "registration" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"category" "reg_category" NOT NULL,
	"group_id" uuid,
	"recorded_by" uuid,
	"device_id" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" uuid,
	CONSTRAINT "registration_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "gift_movement" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" uuid,
	"gift_point_id" uuid NOT NULL,
	"kind" "gift_movement_kind" NOT NULL,
	"qty" integer NOT NULL,
	"reason" text,
	"related_gift_point_id" uuid,
	"recorded_by" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_movement_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "gift_point" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"gift_name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "app_config" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"busy_window_min" integer DEFAULT 30 NOT NULL,
	"busy_pct" integer DEFAULT 80 NOT NULL,
	"quiet_pct" integer DEFAULT 20 NOT NULL,
	"low_stock_pct" integer DEFAULT 10 NOT NULL,
	"email_batch_min" integer DEFAULT 2 NOT NULL,
	"survey_open" boolean DEFAULT false NOT NULL,
	"teams" text[] DEFAULT '{}'::text[] NOT NULL,
	"portfolios" text[] DEFAULT '{}'::text[] NOT NULL,
	"success_targets" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_config_singleton" CHECK ("app_config"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target" text,
	"details" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "auth_token_kind" NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"issued_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "cost_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amount_sgd" numeric(10, 2) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"helped" smallint NOT NULL,
	"most_useful" text,
	"most_annoying" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_helped_range" CHECK ("survey_response"."helped" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_day_id_event_day_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."event_day"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "break_period" ADD CONSTRAINT "break_period_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "break_period" ADD CONSTRAINT "break_period_day_id_event_day_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."event_day"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "break_period" ADD CONSTRAINT "break_period_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_change" ADD CONSTRAINT "duty_change_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_change" ADD CONSTRAINT "duty_change_day_id_event_day_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."event_day"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duty_change" ADD CONSTRAINT "duty_change_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "footfall" ADD CONSTRAINT "footfall_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "footfall" ADD CONSTRAINT "footfall_recorded_by_person_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "footfall" ADD CONSTRAINT "footfall_voided_by_person_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_recorded_by_person_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_voided_by_person_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_movement" ADD CONSTRAINT "gift_movement_gift_point_id_gift_point_id_fk" FOREIGN KEY ("gift_point_id") REFERENCES "public"."gift_point"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_movement" ADD CONSTRAINT "gift_movement_related_gift_point_id_gift_point_id_fk" FOREIGN KEY ("related_gift_point_id") REFERENCES "public"."gift_point"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_movement" ADD CONSTRAINT "gift_movement_recorded_by_person_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_point" ADD CONSTRAINT "gift_point_station_id_station_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."station"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_point" ADD CONSTRAINT "gift_point_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_person_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_token" ADD CONSTRAINT "auth_token_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_token" ADD CONSTRAINT "auth_token_issued_by_person_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_item" ADD CONSTRAINT "cost_item_created_by_person_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_email_unique" ON "person" USING btree ("email");--> statement-breakpoint
CREATE INDEX "assignment_day_person_idx" ON "assignment" USING btree ("day_id","person_id","effective_from");--> statement-breakpoint
CREATE INDEX "break_day_person_idx" ON "break_period" USING btree ("day_id","person_id");--> statement-breakpoint
CREATE INDEX "duty_change_person_idx" ON "duty_change" USING btree ("person_id","acknowledged_at");--> statement-breakpoint
CREATE INDEX "duty_change_email_idx" ON "duty_change" USING btree ("email_status","created_at");--> statement-breakpoint
CREATE INDEX "footfall_station_time_idx" ON "footfall" USING btree ("station_id","recorded_at");--> statement-breakpoint
CREATE INDEX "registration_station_time_idx" ON "registration" USING btree ("station_id","recorded_at");--> statement-breakpoint
CREATE INDEX "gift_movement_point_idx" ON "gift_movement" USING btree ("gift_point_id","recorded_at");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "auth_token_person_idx" ON "auth_token" USING btree ("person_id","kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_one_per_person" ON "survey_response" USING btree ("person_id");