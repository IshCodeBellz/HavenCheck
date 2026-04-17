-- CreateEnum
CREATE TYPE "BillingRateType" AS ENUM ('HOURLY', 'FIXED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'FINALIZED', 'PAID');

-- CreateTable
CREATE TABLE "RateCard" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT,
  "name" TEXT NOT NULL,
  "contractRef" TEXT,
  "billingRateType" "BillingRateType" NOT NULL DEFAULT 'HOURLY',
  "billingHourlyRate" DOUBLE PRECISION,
  "billingFixedRate" DOUBLE PRECISION,
  "payrollHourlyRate" DOUBLE PRECISION NOT NULL,
  "mileageRatePerMile" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "holidayAccrualRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1207,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "rateCardId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'GBP',
  "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "total" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "lineItems" JSONB NOT NULL,
  "xeroReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "carerId" TEXT NOT NULL,
  "rateCardId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
  "hoursWorked" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "mileageMiles" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "mileagePay" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "holidayAccruedHours" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "lineItems" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateCard_organizationId_clientId_active_idx" ON "RateCard"("organizationId", "clientId", "active");
CREATE INDEX "RateCard_organizationId_contractRef_active_idx" ON "RateCard"("organizationId", "contractRef", "active");
CREATE INDEX "Invoice_organizationId_createdAt_idx" ON "Invoice"("organizationId", "createdAt");
CREATE INDEX "Invoice_organizationId_clientId_periodStart_periodEnd_idx" ON "Invoice"("organizationId", "clientId", "periodStart", "periodEnd");
CREATE INDEX "Payslip_organizationId_carerId_periodStart_periodEnd_idx" ON "Payslip"("organizationId", "carerId", "periodStart", "periodEnd");
CREATE INDEX "Payslip_organizationId_createdAt_idx" ON "Payslip"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "RateCard"
ADD CONSTRAINT "RateCard_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RateCard"
ADD CONSTRAINT "RateCard_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_rateCardId_fkey"
FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payslip"
ADD CONSTRAINT "Payslip_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payslip"
ADD CONSTRAINT "Payslip_carerId_fkey"
FOREIGN KEY ("carerId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payslip"
ADD CONSTRAINT "Payslip_rateCardId_fkey"
FOREIGN KEY ("rateCardId") REFERENCES "RateCard"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
