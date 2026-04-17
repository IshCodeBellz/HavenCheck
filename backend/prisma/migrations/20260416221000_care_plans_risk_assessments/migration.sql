-- Create care plan/risk enums
CREATE TYPE "CarePlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "CarePlanSectionType" AS ENUM ('NEEDS', 'STRENGTHS', 'RISKS', 'ACTIONS');
CREATE TYPE "RiskTemplateType" AS ENUM ('FALLS', 'PRESSURE_SORES', 'NUTRITION');

-- Templates
CREATE TABLE "CarePlanTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sections" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePlanTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "templateType" "RiskTemplateType" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "scoringRules" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskTemplate_pkey" PRIMARY KEY ("id")
);

-- Care plans and versions
CREATE TABLE "CarePlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "status" "CarePlanStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewDate" TIMESTAMP(3),
  "reviewReminderAt" TIMESTAMP(3),
  "reviewReminderSentAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "currentVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarePlanVersion" (
  "id" TEXT NOT NULL,
  "carePlanId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "summary" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CarePlanVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CarePlanSection" (
  "id" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "sectionType" "CarePlanSectionType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CarePlanSection_pkey" PRIMARY KEY ("id")
);

-- Risk assessments
CREATE TABLE "RiskAssessment" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "carePlanId" TEXT,
  "templateId" TEXT NOT NULL,
  "answers" JSONB NOT NULL,
  "totalScore" INTEGER NOT NULL,
  "riskLevel" TEXT NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "CarePlanTemplate_organizationId_key_key" ON "CarePlanTemplate"("organizationId", "key");
CREATE UNIQUE INDEX "RiskTemplate_organizationId_templateType_key" ON "RiskTemplate"("organizationId", "templateType");
CREATE UNIQUE INDEX "CarePlanVersion_carePlanId_version_key" ON "CarePlanVersion"("carePlanId", "version");

-- Indexes
CREATE INDEX "CarePlan_organizationId_clientId_status_idx" ON "CarePlan"("organizationId", "clientId", "status");
CREATE INDEX "CarePlan_reviewDate_status_idx" ON "CarePlan"("reviewDate", "status");
CREATE INDEX "CarePlanVersion_carePlanId_createdAt_idx" ON "CarePlanVersion"("carePlanId", "createdAt");
CREATE INDEX "CarePlanSection_versionId_sectionType_orderIndex_idx" ON "CarePlanSection"("versionId", "sectionType", "orderIndex");
CREATE INDEX "RiskAssessment_organizationId_clientId_createdAt_idx" ON "RiskAssessment"("organizationId", "clientId", "createdAt");
CREATE INDEX "RiskAssessment_carePlanId_idx" ON "RiskAssessment"("carePlanId");

-- Foreign keys
ALTER TABLE "CarePlanTemplate"
  ADD CONSTRAINT "CarePlanTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskTemplate"
  ADD CONSTRAINT "RiskTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePlan"
  ADD CONSTRAINT "CarePlan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePlan"
  ADD CONSTRAINT "CarePlan_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePlan"
  ADD CONSTRAINT "CarePlan_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePlanVersion"
  ADD CONSTRAINT "CarePlanVersion_carePlanId_fkey"
  FOREIGN KEY ("carePlanId") REFERENCES "CarePlan"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CarePlanVersion"
  ADD CONSTRAINT "CarePlanVersion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePlanSection"
  ADD CONSTRAINT "CarePlanSection_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "CarePlanVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskAssessment"
  ADD CONSTRAINT "RiskAssessment_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskAssessment"
  ADD CONSTRAINT "RiskAssessment_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RiskAssessment"
  ADD CONSTRAINT "RiskAssessment_carePlanId_fkey"
  FOREIGN KEY ("carePlanId") REFERENCES "CarePlan"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RiskAssessment"
  ADD CONSTRAINT "RiskAssessment_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "RiskTemplate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RiskAssessment"
  ADD CONSTRAINT "RiskAssessment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarePlan"
  ADD CONSTRAINT "CarePlan_currentVersionId_fkey"
  FOREIGN KEY ("currentVersionId") REFERENCES "CarePlanVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
