-- CreateEnum
CREATE TYPE "ClientDocumentCategory" AS ENUM ('CARE_PLAN', 'CONSENT', 'MEDICATION', 'RISK_ASSESSMENT', 'OTHER');

-- AlterTable
ALTER TABLE "ClientDocument"
ADD COLUMN "category" "ClientDocumentCategory" NOT NULL DEFAULT 'OTHER';
