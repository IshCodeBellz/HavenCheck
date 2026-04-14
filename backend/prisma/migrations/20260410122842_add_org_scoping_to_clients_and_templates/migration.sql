-- AlterTable
ALTER TABLE "ChecklistTemplate" ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "organizationId" TEXT;

INSERT INTO "Organization" ("id", "name", "nameNormalized", "createdAt", "updatedAt")
VALUES ('org_' || substr(md5(random()::text || clock_timestamp()::text), 1, 20), 'Haven Flow', 'haven flow', NOW(), NOW())
ON CONFLICT ("nameNormalized") DO NOTHING;

-- Backfill existing rows to Haven Flow organization (or first existing org)
WITH default_org AS (
  SELECT id FROM "Organization" WHERE "nameNormalized" = 'haven flow' LIMIT 1
),
fallback_org AS (
  SELECT id FROM default_org
  UNION ALL
  SELECT id FROM "Organization" LIMIT 1
)
UPDATE "Client"
SET "organizationId" = (SELECT id FROM fallback_org LIMIT 1)
WHERE "organizationId" IS NULL;

WITH default_org AS (
  SELECT id FROM "Organization" WHERE "nameNormalized" = 'haven flow' LIMIT 1
),
fallback_org AS (
  SELECT id FROM default_org
  UNION ALL
  SELECT id FROM "Organization" LIMIT 1
)
UPDATE "ChecklistTemplate"
SET "organizationId" = (SELECT id FROM fallback_org LIMIT 1)
WHERE "organizationId" IS NULL;

ALTER TABLE "ChecklistTemplate" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ChecklistTemplate_organizationId_idx" ON "ChecklistTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
