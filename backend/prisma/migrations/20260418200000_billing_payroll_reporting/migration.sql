-- Visit: optional reported mileage for payroll (overrides GPS-derived miles when set)
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "mileageMilesOverride" DOUBLE PRECISION;

-- Rate card: client-specific billing modifiers (e.g. weekend hourly multiplier), JSON
ALTER TABLE "RateCard" ADD COLUMN IF NOT EXISTS "billingModifiers" JSONB;

-- Payslip: expense reimbursements and net pay
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "expenseReimbursements" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "expenseReimbursementTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "netPayTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Payslip" SET "netPayTotal" = "grossPay" WHERE "netPayTotal" = 0 OR "netPayTotal" IS NULL;
