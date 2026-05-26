-- CreateEnum
CREATE TYPE "RentalExtensionVendorApproval" AS ENUM ('AUTO_APPROVED', 'PENDING_VENDOR', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "rental_extensions" ADD COLUMN "vendor_approval_status" "RentalExtensionVendorApproval" NOT NULL DEFAULT 'AUTO_APPROVED';
ALTER TABLE "rental_extensions" ADD COLUMN "vendor_rejection_reason" TEXT;
