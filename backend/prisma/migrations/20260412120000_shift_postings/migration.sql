-- CreateEnum
CREATE TYPE "ShiftPostingStatus" AS ENUM ('OPEN', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShiftApplicationStatus" AS ENUM ('PENDING', 'SELECTED', 'NOT_SELECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "ShiftPosting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "slotsNeeded" INTEGER NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "status" "ShiftPostingStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftApplication" (
    "id" TEXT NOT NULL,
    "shiftPostingId" TEXT NOT NULL,
    "carerId" TEXT NOT NULL,
    "status" "ShiftApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftPosting_organizationId_status_idx" ON "ShiftPosting"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ShiftPosting_clientId_startTime_idx" ON "ShiftPosting"("clientId", "startTime");

-- CreateIndex
CREATE INDEX "ShiftApplication_carerId_status_idx" ON "ShiftApplication"("carerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftApplication_shiftPostingId_carerId_key" ON "ShiftApplication"("shiftPostingId", "carerId");

-- AddForeignKey
ALTER TABLE "ShiftPosting" ADD CONSTRAINT "ShiftPosting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPosting" ADD CONSTRAINT "ShiftPosting_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftPosting" ADD CONSTRAINT "ShiftPosting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftApplication" ADD CONSTRAINT "ShiftApplication_shiftPostingId_fkey" FOREIGN KEY ("shiftPostingId") REFERENCES "ShiftPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftApplication" ADD CONSTRAINT "ShiftApplication_carerId_fkey" FOREIGN KEY ("carerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
