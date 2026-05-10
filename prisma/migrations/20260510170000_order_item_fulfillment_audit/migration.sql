ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "delivery_proof_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "delivery_condition" TEXT,
  ADD COLUMN IF NOT EXISTS "delivery_proof_urls" JSONB,
  ADD COLUMN IF NOT EXISTS "delivery_line_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "return_proof_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "return_condition" TEXT,
  ADD COLUMN IF NOT EXISTS "return_proof_urls" JSONB,
  ADD COLUMN IF NOT EXISTS "return_line_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "restocked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "restocked_at" TIMESTAMP(3);
