-- CreateEnum
CREATE TYPE "MedicationAlertType" AS ENUM ('MISSED_MEDICATION', 'LATE_MEDICATION', 'PRN_MISUSE', 'LOW_STOCK');

-- CreateTable
CREATE TABLE "MedicationStock" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "currentStock" INTEGER,
    "reorderThreshold" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicationStock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedicationStock_medicationId_key" ON "MedicationStock"("medicationId");

ALTER TABLE "MedicationStock" ADD CONSTRAINT "MedicationStock_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MedicationStock" ("id", "medicationId", "currentStock", "reorderThreshold", "updatedAt")
SELECT replace(gen_random_uuid()::text, '-', ''),
       m."id",
       m."currentStock",
       m."reorderThreshold",
       NOW()
FROM "Medication" m
WHERE m."currentStock" IS NOT NULL OR m."reorderThreshold" IS NOT NULL;

ALTER TABLE "Medication" DROP COLUMN "currentStock",
DROP COLUMN "reorderThreshold";

-- CreateTable
CREATE TABLE "MedicationAlert" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "MedicationAlertType" NOT NULL,
    "medicationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "visitId" TEXT,
    "scheduleId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "metadata" JSONB,
    "notifiedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationAlert_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MedicationAlert_dedupeKey_key" ON "MedicationAlert"("dedupeKey");

CREATE INDEX "MedicationAlert_organizationId_acknowledgedAt_createdAt_idx" ON "MedicationAlert"("organizationId", "acknowledgedAt", "createdAt");

CREATE INDEX "MedicationAlert_organizationId_type_createdAt_idx" ON "MedicationAlert"("organizationId", "type", "createdAt");

ALTER TABLE "MedicationAlert" ADD CONSTRAINT "MedicationAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MedicationAlert" ADD CONSTRAINT "MedicationAlert_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MedicationAlert" ADD CONSTRAINT "MedicationAlert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MedicationAlert" ADD CONSTRAINT "MedicationAlert_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MedicationAlert" ADD CONSTRAINT "MedicationAlert_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "MedicationSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MedicationAlert" ADD CONSTRAINT "MedicationAlert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
