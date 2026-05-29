-- Inventory stock states + vendor package plant allocation

ALTER TABLE "plants"
  ADD COLUMN IF NOT EXISTS "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "delivered_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "inventory_reserved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "inventory_delivered_at" TIMESTAMP(3);

ALTER TABLE "cart_package_items"
  ADD COLUMN IF NOT EXISTS "vendor_package_id" TEXT;

CREATE TABLE IF NOT EXISTS "vendor_package_plants" (
  "id" TEXT NOT NULL,
  "package_id" TEXT NOT NULL,
  "plant_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
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

ALTER TABLE "cart_package_items"
  ADD CONSTRAINT "cart_package_items_vendor_package_id_fkey"
  FOREIGN KEY ("vendor_package_id") REFERENCES "vendor_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
