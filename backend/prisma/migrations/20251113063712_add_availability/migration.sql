-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "carerId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Availability_carerId_startTime_endTime_idx" ON "Availability"("carerId", "startTime", "endTime");

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_carerId_fkey" FOREIGN KEY ("carerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
