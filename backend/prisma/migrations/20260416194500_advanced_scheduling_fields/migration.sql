-- Advanced scheduling fields: travel, skills matrix, preferences.
ALTER TABLE "User"
ADD COLUMN "dbsVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "certifications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preferredClientIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Client"
ADD COLUMN "requiredDbs" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requiredCertifications" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Schedule"
ADD COLUMN "travelDistanceMiles" DOUBLE PRECISION,
ADD COLUMN "travelDurationMinutes" INTEGER,
ADD COLUMN "conflictFlags" TEXT[] DEFAULT ARRAY[]::TEXT[];
