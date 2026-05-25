-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'PENALTY';

-- CreateEnum
CREATE TYPE "OrderComplaintStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "order_complaints" (
    "id" TEXT NOT NULL,
    "complaint_number" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "OrderComplaintStatus" NOT NULL DEFAULT 'OPEN',
    "attachments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_complaints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_complaints_complaint_number_key" ON "order_complaints"("complaint_number");

-- CreateIndex
CREATE INDEX "order_complaints_order_id_idx" ON "order_complaints"("order_id");

-- CreateIndex
CREATE INDEX "order_complaints_user_id_idx" ON "order_complaints"("user_id");

-- AddForeignKey
ALTER TABLE "order_complaints" ADD CONSTRAINT "order_complaints_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_complaints" ADD CONSTRAINT "order_complaints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
