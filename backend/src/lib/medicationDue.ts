/** Minutes before/after scheduled med time and visit window edges to still show as due. */
export const MED_DUE_TOLERANCE_MINUTES = 75;

const DEFAULT_VISIT_LENGTH_MS = 4 * 60 * 60 * 1000;

export type VisitWindowInput = {
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  clockInTime: Date | null;
};

/**
 * Visit window for medication due checks: clock-in if present, else scheduled start/end,
 * else scheduled start + default length.
 */
export function getVisitWindow(visit: VisitWindowInput): { start: Date; end: Date } {
  const start = visit.clockInTime ?? visit.scheduledStart ?? new Date();
  let end = visit.scheduledEnd;
  if (!end) {
    end = new Date(start.getTime() + DEFAULT_VISIT_LENGTH_MS);
  }
  if (end.getTime() < start.getTime()) {
    end = new Date(start.getTime() + DEFAULT_VISIT_LENGTH_MS);
  }
  return { start, end };
}

export function scheduleMatchesDay(daysOfWeek: string[], visitDay: number): boolean {
  if (!daysOfWeek || daysOfWeek.length === 0) return true;
  return daysOfWeek.includes(String(visitDay));
}

/** Combine calendar day of `anchor` with `timeOfDay` "HH:mm" in local time. */
export function combineDateWithTime(anchor: Date, timeOfDay: string): Date {
  const parts = timeOfDay.split(':').map((x) => parseInt(x, 10));
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const out = new Date(anchor);
  out.setHours(h, m, 0, 0);
  return out;
}

/**
 * True if this schedule's time falls within the visit window (± tolerance).
 */
export function isScheduleDueDuringVisit(
  visit: VisitWindowInput,
  schedule: { timeOfDay: string; daysOfWeek: string[]; active: boolean }
): boolean {
  if (!schedule.active) return false;
  const { start, end } = getVisitWindow(visit);
  const anchor = visit.clockInTime ?? visit.scheduledStart ?? start;
  const visitDay = anchor.getDay();
  if (!scheduleMatchesDay(schedule.daysOfWeek, visitDay)) return false;

  const scheduledAt = combineDateWithTime(anchor, schedule.timeOfDay);
  const tolMs = MED_DUE_TOLERANCE_MINUTES * 60 * 1000;
  const windowStartT = start.getTime() - tolMs;
  const windowEndT = end.getTime() + tolMs;
  const t = scheduledAt.getTime();
  return t >= windowStartT && t <= windowEndT;
}
