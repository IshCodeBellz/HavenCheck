DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentSeverity') THEN
    CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentStatus') THEN
    CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'TRIAGED', 'ESCALATED', 'ACTIONED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentActionStatus') THEN
    CREATE TYPE "IncidentActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');
  END IF;
END $$;

CREATE TABLE "Incident" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "visitId" TEXT,
  "reportedById" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "severity" "IncidentSeverity" NOT NULL,
  "safeguardingFlag" BOOLEAN NOT NULL DEFAULT false,
  "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
  "details" TEXT,
  "closedAt" TIMESTAMP(3),
  "closedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentEscalation" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "escalatedById" TEXT NOT NULL,
  "slaDueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentEscalation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentFollowUp" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "done" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IncidentFollowUp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IncidentAction" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "ownerUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3),
  "status" "IncidentActionStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IncidentAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BodyMapEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "incidentId" TEXT,
  "recordedById" TEXT NOT NULL,
  "coordinates" JSONB NOT NULL,
  "notes" TEXT,
  "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BodyMapEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuardianLink" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "guardianUserId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "readOnly" BOOLEAN NOT NULL DEFAULT true,
  "canViewVisits" BOOLEAN NOT NULL DEFAULT true,
  "canViewNotes" BOOLEAN NOT NULL DEFAULT true,
  "canViewIncidents" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuardianLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuardianFeedEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuardianFeedEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuardianLink_guardianUserId_clientId_key" ON "GuardianLink"("guardianUserId", "clientId");
CREATE INDEX "Incident_organizationId_createdAt_idx" ON "Incident"("organizationId", "createdAt");
CREATE INDEX "Incident_clientId_createdAt_idx" ON "Incident"("clientId", "createdAt");
CREATE INDEX "Incident_visitId_idx" ON "Incident"("visitId");
CREATE INDEX "Incident_status_severity_idx" ON "Incident"("status", "severity");
CREATE INDEX "IncidentEscalation_incidentId_createdAt_idx" ON "IncidentEscalation"("incidentId", "createdAt");
CREATE INDEX "IncidentFollowUp_incidentId_createdAt_idx" ON "IncidentFollowUp"("incidentId", "createdAt");
CREATE INDEX "IncidentAction_incidentId_status_idx" ON "IncidentAction"("incidentId", "status");
CREATE INDEX "IncidentAction_ownerUserId_status_idx" ON "IncidentAction"("ownerUserId", "status");
CREATE INDEX "BodyMapEntry_organizationId_clientId_createdAt_idx" ON "BodyMapEntry"("organizationId", "clientId", "createdAt");
CREATE INDEX "BodyMapEntry_incidentId_createdAt_idx" ON "BodyMapEntry"("incidentId", "createdAt");
CREATE INDEX "GuardianLink_organizationId_guardianUserId_active_idx" ON "GuardianLink"("organizationId", "guardianUserId", "active");
CREATE INDEX "GuardianFeedEvent_organizationId_clientId_createdAt_idx" ON "GuardianFeedEvent"("organizationId", "clientId", "createdAt");
CREATE INDEX "GuardianFeedEvent_sourceType_sourceId_idx" ON "GuardianFeedEvent"("sourceType", "sourceId");

ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_visitId_fkey"
  FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_reportedById_fkey"
  FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IncidentEscalation" ADD CONSTRAINT "IncidentEscalation_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentEscalation" ADD CONSTRAINT "IncidentEscalation_escalatedById_fkey"
  FOREIGN KEY ("escalatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IncidentFollowUp" ADD CONSTRAINT "IncidentFollowUp_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IncidentAction" ADD CONSTRAINT "IncidentAction_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BodyMapEntry" ADD CONSTRAINT "BodyMapEntry_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BodyMapEntry" ADD CONSTRAINT "BodyMapEntry_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BodyMapEntry" ADD CONSTRAINT "BodyMapEntry_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BodyMapEntry" ADD CONSTRAINT "BodyMapEntry_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_guardianUserId_fkey"
  FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianLink" ADD CONSTRAINT "GuardianLink_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuardianFeedEvent" ADD CONSTRAINT "GuardianFeedEvent_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianFeedEvent" ADD CONSTRAINT "GuardianFeedEvent_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuardianFeedEvent" ADD CONSTRAINT "GuardianFeedEvent_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
