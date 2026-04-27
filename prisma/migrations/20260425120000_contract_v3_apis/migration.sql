-- Contract v3.1: vendor packages, freelance jobs, workflow, penalties, idempotency, manual intervention

CREATE TYPE "FreelanceJobStatus" AS ENUM ('OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ManualInterventionStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "OrderPenaltyPayStatus" AS ENUM ('PENDING', 'PAID');

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "register_meta" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "gardeners" ADD COLUMN IF NOT EXISTS "staff_role" TEXT;
ALTER TABLE "gardeners" ADD COLUMN IF NOT EXISTS "staff_notes" TEXT;
ALTER TABLE "gardeners" ADD COLUMN IF NOT EXISTS "deactivated_at" TIMESTAMP(3);
ALTER TABLE "gardeners" ADD COLUMN IF NOT EXISTS "deactivate_reason" TEXT;

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "workflow_meta" JSONB;

CREATE TABLE "vendor_packages" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "nursery_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "description" TEXT,
    "max_plant_count" INTEGER NOT NULL,
    "rental_duration_days" INTEGER NOT NULL,
    "includes_maintenance" BOOLEAN NOT NULL DEFAULT false,
    "maintenance_visits_per_month" INTEGER NOT NULL DEFAULT 0,
    "base_price" DECIMAL(12,2) NOT NULL,
    "deposit_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "allows_installments" BOOLEAN NOT NULL DEFAULT false,
    "installment_options" JSONB,
    "add_ons" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_packages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vendor_packages_public_id_key" ON "vendor_packages"("public_id");
CREATE INDEX "vendor_packages_nursery_id_is_active_idx" ON "vendor_packages"("nursery_id", "is_active");

ALTER TABLE "vendor_packages" ADD CONSTRAINT "vendor_packages_nursery_id_fkey" FOREIGN KEY ("nursery_id") REFERENCES "nurseries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "freelance_jobs" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "delivery_address_id" TEXT NOT NULL,
    "care_types" TEXT[] NOT NULL,
    "preferred_date" DATE NOT NULL,
    "time_from" TEXT NOT NULL,
    "time_to" TEXT NOT NULL,
    "plant_details" TEXT,
    "special_instructions" TEXT,
    "status" "FreelanceJobStatus" NOT NULL DEFAULT 'OPEN',
    "accepted_gardener_id" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "completion_notes" TEXT,
    "completion_photo_urls" JSONB,
    "review_rating" INTEGER,
    "review_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelance_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "freelance_jobs_public_id_key" ON "freelance_jobs"("public_id");
CREATE INDEX "freelance_jobs_status_created_at_idx" ON "freelance_jobs"("status", "created_at");

ALTER TABLE "freelance_jobs" ADD CONSTRAINT "freelance_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "freelance_jobs" ADD CONSTRAINT "freelance_jobs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "freelance_jobs" ADD CONSTRAINT "freelance_jobs_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "user_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "freelance_jobs" ADD CONSTRAINT "freelance_jobs_accepted_gardener_id_fkey" FOREIGN KEY ("accepted_gardener_id") REFERENCES "gardeners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" TEXT,
    "route" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_body" JSONB NOT NULL,
    "status_code" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_key_route_key" ON "idempotency_records"("key", "route");
CREATE INDEX "idempotency_records_key_idx" ON "idempotency_records"("key");

ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "manual_intervention_orders" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "status" "ManualInterventionStatus" NOT NULL DEFAULT 'OPEN',
    "priority" TEXT DEFAULT 'NORMAL',
    "reason" TEXT,
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "manual_intervention_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manual_intervention_orders_order_id_key" ON "manual_intervention_orders"("order_id");

ALTER TABLE "manual_intervention_orders" ADD CONSTRAINT "manual_intervention_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "order_penalties" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "overdue_days" INTEGER NOT NULL DEFAULT 0,
    "penalty_multiplier" DECIMAL(6,4),
    "running_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "avg_daily_rate" DECIMAL(12,2),
    "pay_status" "OrderPenaltyPayStatus" NOT NULL DEFAULT 'PENDING',
    "meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_penalties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_penalties_order_id_key" ON "order_penalties"("order_id");

ALTER TABLE "order_penalties" ADD CONSTRAINT "order_penalties_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "freelance_match_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "auto_match_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_match_score_threshold" DECIMAL(4,3) NOT NULL DEFAULT 0.8,
    "gardener_accept_window_minutes" INTEGER NOT NULL DEFAULT 30,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "freelance_match_config_pkey" PRIMARY KEY ("id")
);

INSERT INTO "freelance_match_config" ("id", "auto_match_enabled", "auto_match_score_threshold", "gardener_accept_window_minutes", "updated_at")
VALUES ('singleton', false, 0.8, 30, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
