-- FreelanceJob marketplace: budget, cancellation audit, customer payment + gardener earnings

-- PaymentType
DO $$ BEGIN
  ALTER TYPE "PaymentType" ADD VALUE 'FREELANCE_JOB';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- EarningType
DO $$ BEGIN
  ALTER TYPE "EarningType" ADD VALUE 'FREELANCE_MARKET_JOB';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "freelance_jobs"
  ADD COLUMN IF NOT EXISTS "budget_amount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelled_by_role" TEXT,
  ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);

ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "freelance_job_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_freelance_job_id_fkey"
    FOREIGN KEY ("freelance_job_id") REFERENCES "freelance_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "payments_freelance_job_id_idx" ON "payments"("freelance_job_id");

ALTER TABLE "gardener_earnings"
  ADD COLUMN IF NOT EXISTS "freelance_job_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "gardener_earnings_freelance_job_id_key" ON "gardener_earnings"("freelance_job_id");

DO $$ BEGIN
  ALTER TABLE "gardener_earnings" ADD CONSTRAINT "gardener_earnings_freelance_job_id_fkey"
    FOREIGN KEY ("freelance_job_id") REFERENCES "freelance_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
