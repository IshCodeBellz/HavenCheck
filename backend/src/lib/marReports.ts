import type { Prisma } from '@prisma/client';
import { MedicationEventStatus } from '@prisma/client';

/** Local start of day for YYYY-MM-DD (avoids UTC-only date parsing surprises). */
export function parseQueryDateFrom(s?: string): Date | undefined {
  if (!s) return undefined;
  const parts = String(s).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined;
  const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local end of day for YYYY-MM-DD. */
export function parseQueryDateTo(s?: string): Date | undefined {
  if (!s) return undefined;
  const parts = String(s).split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined;
  const d = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function buildMedicationEventWhere(
  organizationId: string,
  query: { clientId?: string; from?: string; to?: string; status?: string }
): Prisma.MedicationEventWhereInput {
  const where: Prisma.MedicationEventWhereInput = { organizationId, deletedAt: null };
  if (query.clientId) where.clientId = String(query.clientId);
  if (query.status === MedicationEventStatus.ADMINISTERED || query.status === MedicationEventStatus.OMITTED) {
    where.status = query.status;
  }
  const from = parseQueryDateFrom(query.from);
  const to = parseQueryDateTo(query.to);
  if (from || to) {
    where.administeredAt = {};
    if (from) where.administeredAt.gte = from;
    if (to) where.administeredAt.lte = to;
  }
  return where;
}

export function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
