-- Align DB with prisma/schema.prisma (missing columns caused Prisma P2022 → HTTP 500)

-- Order: vendor JSON snapshot for approval flow
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "vendor_approval_selections" JSONB;

-- Maintenance task proposal / feedback fields
DO $$ BEGIN
    CREATE TYPE "MaintenanceProposalStatus" AS ENUM ('NONE', 'AWAITING_CUSTOMER', 'APPROVED', 'RESCHEDULE_REQUESTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "proposal_status" "MaintenanceProposalStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "vendor_proposed_date" DATE;
ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "vendor_proposed_time" TEXT;
ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "customer_counter_date" DATE;
ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "customer_counter_time" TEXT;
ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "maintenance_feedback_rating" INTEGER;
ALTER TABLE "maintenance_tasks" ADD COLUMN IF NOT EXISTS "maintenance_feedback_comment" TEXT;

-- Schema marks gardener as optional (tasks can exist before assignment)
ALTER TABLE "maintenance_tasks" ALTER COLUMN "gardener_id" DROP NOT NULL;
