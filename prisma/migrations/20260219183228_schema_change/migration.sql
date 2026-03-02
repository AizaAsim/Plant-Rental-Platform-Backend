-- CreateTable
CREATE TABLE "plant_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "is_customizable" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plant_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plant_package_items" (
    "id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plant_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_plant_packages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "base_package_id" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_plant_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_plant_package_items" (
    "id" TEXT NOT NULL,
    "custom_package_id" TEXT NOT NULL,
    "plant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_plant_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_package_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "package_id" TEXT,
    "custom_package_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plant_packages_slug_key" ON "plant_packages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plant_package_items_package_id_plant_id_key" ON "plant_package_items"("package_id", "plant_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_plant_package_items_custom_package_id_plant_id_key" ON "custom_plant_package_items"("custom_package_id", "plant_id");

-- AddForeignKey
ALTER TABLE "plant_package_items" ADD CONSTRAINT "plant_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "plant_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plant_package_items" ADD CONSTRAINT "plant_package_items_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_plant_packages" ADD CONSTRAINT "custom_plant_packages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_plant_packages" ADD CONSTRAINT "custom_plant_packages_base_package_id_fkey" FOREIGN KEY ("base_package_id") REFERENCES "plant_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_plant_package_items" ADD CONSTRAINT "custom_plant_package_items_custom_package_id_fkey" FOREIGN KEY ("custom_package_id") REFERENCES "custom_plant_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_plant_package_items" ADD CONSTRAINT "custom_plant_package_items_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_package_items" ADD CONSTRAINT "cart_package_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_package_items" ADD CONSTRAINT "cart_package_items_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "plant_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_package_items" ADD CONSTRAINT "cart_package_items_custom_package_id_fkey" FOREIGN KEY ("custom_package_id") REFERENCES "custom_plant_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
