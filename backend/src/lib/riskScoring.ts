export type ScoringRule = { key: string; label: string; weight: number };

export type ScoreBreakdownLine = {
  key: string;
  label: string;
  weight: number;
  answer: number;
  contribution: number;
};

export type RiskScoreResult = {
  totalScore: number;
  maxScore: number;
  breakdown: ScoreBreakdownLine[];
};

export function computeRiskScore(rules: ScoringRule[], answers: Record<string, number>): RiskScoreResult {
  const breakdown: ScoreBreakdownLine[] = [];
  let totalScore = 0;
  let maxScore = 0;
  for (const rule of rules) {
    const raw = answers[rule.key];
    const answer = typeof raw === 'number' && !Number.isNaN(raw) ? Math.min(3, Math.max(0, Math.trunc(raw))) : 0;
    const contribution = answer * rule.weight;
    totalScore += contribution;
    maxScore += 3 * rule.weight;
    breakdown.push({
      key: rule.key,
      label: rule.label,
      weight: rule.weight,
      answer,
      contribution,
    });
  }
  return { totalScore, maxScore, breakdown };
}

export function riskLevelFromScore(totalScore: number): string {
  if (totalScore >= 8) return 'HIGH';
  if (totalScore >= 4) return 'MEDIUM';
  return 'LOW';
}
