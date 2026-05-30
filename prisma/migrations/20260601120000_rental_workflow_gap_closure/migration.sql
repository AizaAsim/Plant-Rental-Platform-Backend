-- Rental workflow gap closure: packages, pickup, complaints, maintenance logs

-- Enums
DO $$ BEGIN
  ALTER TYPE "RentalStatus" ADD VALUE IF NOT EXISTS 'PICKUP_PENDING';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TYPE "PickupRequestStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "OrderComplaintType" AS ENUM (
  'DAMAGED_PLANTS',
  'INCORRECT_DELIVERY',
  'UNHEALTHY_PLANTS',
  'MISSING_ITEMS',
  'MAINTENANCE_ISSUE',
  'PICKUP_PROBLEM',
  'OTHER'
);

DO $$ BEGIN
  ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'DELIVERY';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'PICKUP';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Orders
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "vendor_package_id" TEXT,
  ADD COLUMN IF NOT EXISTS "booking_meta" JSONB;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_vendor_package_id_fkey"
  FOREIGN KEY ("vendor_package_id") REFERENCES "vendor_packages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Vendor packages
ALTER TABLE "vendor_packages"
  ADD COLUMN IF NOT EXISTS "delivery_slots" JSONB;

CREATE TABLE IF NOT EXISTS "vendor_package_plants" (
  "id" TEXT NOT NULL,
  "package_id" TEXT NOT NULL,
  "plant_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "vendor_package_plants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vendor_package_plants_package_id_plant_id_key"
  ON "vendor_package_plants"("package_id", "plant_id");
CREATE INDEX IF NOT EXISTS "vendor_package_plants_plant_id_idx"
  ON "vendor_package_plants"("plant_id");

ALTER TABLE "vendor_package_plants"
  ADD CONSTRAINT "vendor_package_plants_package_id_fkey"
  FOREIGN KEY ("package_id") REFERENCES "vendor_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vendor_package_plants"
  ADD CONSTRAINT "vendor_package_plants_plant_id_fkey"
  FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cart
ALTER TABLE "cart_package_items"
  ADD COLUMN IF NOT EXISTS "vendor_package_id" TEXT,
  ADD COLUMN IF NOT EXISTS "selected_plants" JSONB;

ALTER TABLE "cart_package_items"
  ADD CONSTRAINT "cart_package_items_vendor_package_id_fkey"
  FOREIGN KEY ("vendor_package_id") REFERENCES "vendor_packages"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Pickup requests
CREATE TABLE IF NOT EXISTS "pickup_requests" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "status" "PickupRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "requested_pickup_date" DATE NOT NULL,
  "preferred_time_from" TEXT NOT NULL,
  "preferred_time_to" TEXT NOT NULL,
  "notes" TEXT,
  "assigned_gardener_ids" JSONB,
  "pickup_task_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pickup_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pickup_requests_order_id_idx" ON "pickup_requests"("order_id");
CREATE INDEX IF NOT EXISTS "pickup_requests_order_item_id_idx" ON "pickup_requests"("order_item_id");

ALTER TABLE "pickup_requests"
  ADD CONSTRAINT "pickup_requests_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pickup_requests"
  ADD CONSTRAINT "pickup_requests_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pickup_requests"
  ADD CONSTRAINT "pickup_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Maintenance visit logs
CREATE TABLE IF NOT EXISTS "maintenance_visit_logs" (
  "id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "order_item_id" TEXT,
  "gardener_id" TEXT NOT NULL,
  "visit_date" DATE NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "tasks_performed" TEXT[],
  "maintenance_notes" TEXT,
  "photo_urls" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "maintenance_visit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "maintenance_visit_logs_task_id_idx" ON "maintenance_visit_logs"("task_id");
CREATE INDEX IF NOT EXISTS "maintenance_visit_logs_order_item_id_idx" ON "maintenance_visit_logs"("order_item_id");

ALTER TABLE "maintenance_visit_logs"
  ADD CONSTRAINT "maintenance_visit_logs_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "maintenance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_visit_logs"
  ADD CONSTRAINT "maintenance_visit_logs_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Complaints
ALTER TABLE "order_complaints"
  ADD COLUMN IF NOT EXISTS "complaint_type" "OrderComplaintType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS "resolution_note" TEXT;

CREATE TABLE IF NOT EXISTS "order_complaint_messages" (
  "id" TEXT NOT NULL,
  "complaint_id" TEXT NOT NULL,
  "author_user_id" TEXT NOT NULL,
  "author_role" "UserRole" NOT NULL,
  "message" TEXT NOT NULL,
  "proposed_resolution" TEXT,
  "attachments" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_complaint_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "order_complaint_messages_complaint_id_idx"
  ON "order_complaint_messages"("complaint_id");

ALTER TABLE "order_complaint_messages"
  ADD CONSTRAINT "order_complaint_messages_complaint_id_fkey"
  FOREIGN KEY ("complaint_id") REFERENCES "order_complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_complaint_messages"
  ADD CONSTRAINT "order_complaint_messages_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
