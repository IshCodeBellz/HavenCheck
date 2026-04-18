import { MedicationEventStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { parseQueryDateFrom, parseQueryDateTo } from '../lib/marReports';

type ExceptionsFilters = {
  clientId?: string;
  from?: string;
  to?: string;
};

function buildExceptionWhere(organizationId: string, filters: ExceptionsFilters): Prisma.MedicationEventWhereInput {
  const where: Prisma.MedicationEventWhereInput = {
    organizationId,
    status: MedicationEventStatus.OMITTED,
    deletedAt: null,
  };

  if (filters.clientId) where.clientId = filters.clientId;
  const from = parseQueryDateFrom(filters.from);
  const to = parseQueryDateTo(filters.to);
  if (from || to) {
    where.administeredAt = {};
    if (from) where.administeredAt.gte = from;
    if (to) where.administeredAt.lte = to;
  }
  return where;
}

function classifyReason(reasonCode: string | null | undefined): 'missed' | 'refused' | 'late' | 'other' {
  const reason = (reasonCode || '').toUpperCase();
  if (reason.includes('REFUS')) return 'refused';
  if (reason.includes('LATE')) return 'late';
  if (reason.includes('MISS')) return 'missed';
  return 'other';
}

export const emarService = {
  async getExceptions(organizationId: string, filters: ExceptionsFilters) {
    const where = buildExceptionWhere(organizationId, filters);

    const events = await prisma.medicationEvent.findMany({
      where,
      select: {
        id: true,
        administeredAt: true,
        reasonCode: true,
        note: true,
        client: { select: { id: true, name: true } },
        medication: { select: { id: true, name: true } },
        recordedBy: { select: { id: true, name: true } },
      },
      orderBy: { administeredAt: 'desc' },
      take: 1000,
    });

    const summary = { missed: 0, refused: 0, late: 0 };
    for (const event of events) {
      const bucket = classifyReason(event.reasonCode);
      if (bucket === 'missed') summary.missed += 1;
      if (bucket === 'refused') summary.refused += 1;
      if (bucket === 'late') summary.late += 1;
    }

    return {
      summary,
      events,
      filters: {
        clientId: filters.clientId ?? null,
        from: filters.from ?? null,
        to: filters.to ?? null,
      },
    };
  },
};
