-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateTable
CREATE TABLE "NurseryInvitation" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "gardenerId" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NurseryInvitation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NurseryInvitation" ADD CONSTRAINT "NurseryInvitation_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "nurseries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NurseryInvitation" ADD CONSTRAINT "NurseryInvitation_gardenerId_fkey" FOREIGN KEY ("gardenerId") REFERENCES "gardeners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
