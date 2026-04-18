-- Persist structured risk score breakdown at assessment time (rules may change later).
ALTER TABLE "RiskAssessment" ADD COLUMN "scoreBreakdown" JSONB;
