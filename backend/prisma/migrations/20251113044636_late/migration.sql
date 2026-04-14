-- AlterEnum
ALTER TYPE "VisitStatus" ADD VALUE 'INCOMPLETE';

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "lateClockInReason" TEXT;
