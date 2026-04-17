-- AlterTable
ALTER TABLE "Medication"
ADD COLUMN "currentStock" INTEGER,
ADD COLUMN "reorderThreshold" INTEGER;

-- AlterTable
ALTER TABLE "MedicationSchedule"
ADD COLUMN "isPrn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MedicationEvent"
ADD COLUMN "dosageGiven" TEXT,
ADD COLUMN "signatureImage" TEXT,
ADD COLUMN "signedAt" TIMESTAMP(3),
ADD COLUMN "signedByUserId" TEXT,
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedById" TEXT;

-- CreateIndex
CREATE INDEX "MedicationEvent_organizationId_deletedAt_administeredAt_idx"
ON "MedicationEvent"("organizationId", "deletedAt", "administeredAt");

-- AddForeignKey
ALTER TABLE "MedicationEvent"
ADD CONSTRAINT "MedicationEvent_signedByUserId_fkey"
FOREIGN KEY ("signedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationEvent"
ADD CONSTRAINT "MedicationEvent_deletedById_fkey"
FOREIGN KEY ("deletedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
