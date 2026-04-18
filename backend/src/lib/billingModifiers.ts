import { BillingRateType } from '@prisma/client';

type BillingModifiersShape = {
  weekendHourlyMultiplier?: number;
};

export function billingMultiplierForVisit(at: Date, billingModifiers: unknown): number {
  const m = billingModifiers as BillingModifiersShape | null | undefined;
  if (!m?.weekendHourlyMultiplier || m.weekendHourlyMultiplier <= 0) return 1;
  const d = at.getUTCDay();
  const isWeekend = d === 0 || d === 6;
  return isWeekend ? m.weekendHourlyMultiplier : 1;
}

export function adjustedUnitAmount(
  billingRateType: BillingRateType,
  baseUnitAmount: number,
  at: Date,
  billingModifiers: unknown
): number {
  const mult = billingMultiplierForVisit(at, billingModifiers);
  if (billingRateType === BillingRateType.HOURLY) {
    return Number((baseUnitAmount * mult).toFixed(2));
  }
  return Number((baseUnitAmount * mult).toFixed(2));
}
