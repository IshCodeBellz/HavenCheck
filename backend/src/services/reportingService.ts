import {
  IncidentSeverity,
  IncidentStatus,
  InvoiceStatus,
  MedicationEventStatus,
  Prisma,
  VisitStatus,
} from '@prisma/client';
import { subDays } from 'date-fns';
import { prisma } from '../lib/prisma';
import { buildMedicationEventWhere, parseQueryDateFrom, parseQueryDateTo } from '../lib/marReports';
import { visitsService } from './visits';

function buildRange(from?: string, to?: string) {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (from) createdAt.gte = new Date(from);
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    createdAt.lte = end;
  }
  return Object.keys(createdAt).length ? createdAt : undefined;
}

export type OrgReportFilters = {
  from?: string;
  to?: string;
  clientId?: string;
  carerId?: string;
};

export type IncidentReportFilters = OrgReportFilters & {
  severity?: string;
  status?: string;
};

function visitScheduledFilter(filters: OrgReportFilters): Prisma.DateTimeNullableFilter | undefined {
  const from = parseQueryDateFrom(filters.from);
  const to = parseQueryDateTo(filters.to);
  if (!from && !to) return undefined;
  const w: Prisma.DateTimeNullableFilter = {};
  if (from) w.gte = from;
  if (to) w.lte = to;
  return w;
}

function defaultVisitRange(): Prisma.DateTimeNullableFilter {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = subDays(to, 90);
  from.setHours(0, 0, 0, 0);
  return { gte: from, lte: to };
}

function baseVisitWhere(organizationId: string, filters: OrgReportFilters): Prisma.VisitWhereInput {
  const w: Prisma.VisitWhereInput = {
    client: { organizationId },
  };
  if (filters.clientId) w.clientId = filters.clientId;
  if (filters.carerId) w.carerId = filters.carerId;
  const sched = visitScheduledFilter(filters);
  w.scheduledStart = sched ?? defaultVisitRange();
  return w;
}

function incidentCreatedFilter(filters: OrgReportFilters): Prisma.DateTimeFilter {
  let from = parseQueryDateFrom(filters.from);
  let to = parseQueryDateTo(filters.to);
  if (!from && !to) {
    to = new Date();
    to.setHours(23, 59, 59, 999);
    from = subDays(to, 30);
    from.setHours(0, 0, 0, 0);
  } else {
    if (!from) from = new Date(2000, 0, 1);
    if (!to) {
      to = new Date();
      to.setHours(23, 59, 59, 999);
    }
  }
  return { gte: from, lte: to };
}

function payslipPeriodOverlap(from: Date, to: Date): Prisma.PayslipWhereInput {
  return {
    AND: [{ periodStart: { lte: to } }, { periodEnd: { gte: from } }],
  };
}

export const reportingService = {
  async getEnterpriseReports(organizationId: string, from?: string, to?: string) {
    const range = buildRange(from, to);
    const visitWhere: Prisma.VisitWhereInput = { client: { organizationId } };
    if (range) visitWhere.scheduledStart = range;

    const medWhere: Prisma.MedicationEventWhereInput = { organizationId, deletedAt: null };
    if (range) medWhere.administeredAt = range;

    const [missedVisits, completedVisits, lateVisits, medAdministered, medOmitted, timesheet, incidents, activeClients] =
      await Promise.all([
        prisma.visit.count({ where: { ...visitWhere, status: VisitStatus.MISSED } }),
        prisma.visit.count({ where: { ...visitWhere, status: VisitStatus.COMPLETED } }),
        prisma.visit.count({ where: { ...visitWhere, status: VisitStatus.LATE } }),
        prisma.medicationEvent.count({ where: { ...medWhere, status: MedicationEventStatus.ADMINISTERED } }),
        prisma.medicationEvent.count({ where: { ...medWhere, status: MedicationEventStatus.OMITTED } }),
        prisma.visit.findMany({
          where: {
            ...visitWhere,
            clockInTime: { not: null },
            clockOutTime: { not: null },
          },
          select: { clockInTime: true, clockOutTime: true },
        }),
        prisma.incident.count({ where: { organizationId, ...(range ? { createdAt: range } : {}) } }),
        prisma.client.count({ where: { organizationId, active: true } }),
      ]);

    const hoursDelivered = timesheet.reduce((acc, row) => {
      if (!row.clockInTime || !row.clockOutTime) return acc;
      return acc + (row.clockOutTime.getTime() - row.clockInTime.getTime()) / 3600000;
    }, 0);

    const totalMed = medAdministered + medOmitted;
    const medComplianceRate = totalMed > 0 ? medAdministered / totalMed : 0;

    const totalHours = Number(hoursDelivered.toFixed(2));
    let rangeStart = parseQueryDateFrom(from ?? undefined);
    let rangeEnd = parseQueryDateTo(to ?? undefined);
    if (!rangeStart && !rangeEnd) {
      rangeStart = new Date(0);
      rangeEnd = new Date(8640000000000000);
    } else {
      if (!rangeStart) rangeStart = new Date(0);
      if (!rangeEnd) {
        rangeEnd = new Date();
        rangeEnd.setHours(23, 59, 59, 999);
      }
    }

    const [revenueAgg, payrollAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          organizationId,
          status: { in: [InvoiceStatus.ISSUED, InvoiceStatus.PAID] },
          AND: [{ periodStart: { lte: rangeEnd } }, { periodEnd: { gte: rangeStart } }],
        },
        _sum: { total: true },
      }),
      prisma.payslip.aggregate({
        where: {
          organizationId,
          ...payslipPeriodOverlap(rangeStart, rangeEnd),
        },
        _sum: { netPayTotal: true },
      }),
    ]);
    const revenue = Number((revenueAgg._sum.total ?? 0).toFixed(2));
    const payrollCosts = Number((payrollAgg._sum.netPayTotal ?? 0).toFixed(2));

    return {
      reports: [
        { key: 'missed_visits', value: missedVisits },
        { key: 'med_compliance', value: medComplianceRate },
        { key: 'hours_delivered', value: totalHours },
        { key: 'total_hours', value: totalHours },
        { key: 'revenue', value: revenue },
        { key: 'payroll_costs', value: payrollCosts },
        { key: 'completed_visits', value: completedVisits },
        { key: 'late_visits', value: lateVisits },
        { key: 'med_administered', value: medAdministered },
        { key: 'med_omitted', value: medOmitted },
        { key: 'incident_count', value: incidents },
        { key: 'active_clients', value: activeClients },
        {
          key: 'visit_completion_rate',
          value: completedVisits + missedVisits > 0 ? completedVisits / (completedVisits + missedVisits) : 0,
        },
      ],
      filters: { from: from || null, to: to || null },
    };
  },

  async getMissedVisitsReport(organizationId: string, filters: OrgReportFilters) {
    await visitsService.ensureVisitStatusesFresh();
    const where: Prisma.VisitWhereInput = {
      ...baseVisitWhere(organizationId, filters),
      status: VisitStatus.MISSED,
    };

    const visits = await prisma.visit.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        carer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { scheduledStart: 'desc' },
      take: 2000,
    });

    const rows = visits.map((v) => ({
      visitId: v.id,
      clientId: v.clientId,
      clientName: v.client.name,
      carerId: v.carerId,
      carerName: v.carer.name,
      scheduledStart: v.scheduledStart?.toISOString() ?? '',
      scheduledEnd: v.scheduledEnd?.toISOString() ?? '',
    }));

    return {
      total: rows.length,
      rows,
      filters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        clientId: filters.clientId ?? null,
        carerId: filters.carerId ?? null,
      },
    };
  },

  async getMedicationComplianceReport(organizationId: string, filters: OrgReportFilters) {
    const where = buildMedicationEventWhere(organizationId, {
      clientId: filters.clientId,
      from: filters.from,
      to: filters.to,
    });

    const [byStatus, reasonGroups, byClientStatus] = await Promise.all([
      prisma.medicationEvent.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      prisma.medicationEvent.groupBy({
        by: ['reasonCode'],
        where: {
          ...where,
          status: MedicationEventStatus.OMITTED,
          reasonCode: { not: null },
        },
        _count: { _all: true },
      }),
      prisma.medicationEvent.groupBy({
        by: ['clientId', 'status'],
        where,
        _count: { _all: true },
      }),
    ]);

    let administered = 0;
    let omitted = 0;
    for (const row of byStatus) {
      if (row.status === MedicationEventStatus.ADMINISTERED) administered = row._count._all;
      if (row.status === MedicationEventStatus.OMITTED) omitted = row._count._all;
    }
    const totalEvents = administered + omitted;
    const administeredRate = totalEvents > 0 ? administered / totalEvents : 0;

    const topOmissionReasons = reasonGroups
      .filter((r) => r.reasonCode)
      .map((r) => ({ reason: r.reasonCode as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const perClient = new Map<string, { clientId: string; administered: number; omitted: number }>();
    for (const row of byClientStatus) {
      const cur = perClient.get(row.clientId) || { clientId: row.clientId, administered: 0, omitted: 0 };
      if (row.status === MedicationEventStatus.ADMINISTERED) cur.administered = row._count._all;
      if (row.status === MedicationEventStatus.OMITTED) cur.omitted = row._count._all;
      perClient.set(row.clientId, cur);
    }

    const clientIds = [...perClient.keys()];
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds }, organizationId },
      select: { id: true, name: true },
    });
    const nameById = new Map(clients.map((c) => [c.id, c.name]));

    const byClient = [...perClient.values()]
      .map((c) => {
        const sub = c.administered + c.omitted;
        return {
          clientId: c.clientId,
          clientName: nameById.get(c.clientId) ?? c.clientId,
          administered: c.administered,
          omitted: c.omitted,
          complianceRate: sub > 0 ? c.administered / sub : null as number | null,
        };
      })
      .sort((a, b) => b.administered + b.omitted - (a.administered + a.omitted));

    return {
      summary: {
        totalEvents,
        administered,
        omitted,
        administeredRate,
      },
      topOmissionReasons,
      byClient,
      filters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        clientId: filters.clientId ?? null,
        carerId: null,
      },
    };
  },

  async getHoursDeliveredReport(organizationId: string, filters: OrgReportFilters) {
    const data = await visitsService.getTimesheetReport({
      organizationId,
      from: filters.from,
      to: filters.to,
      carerId: filters.carerId,
      clientId: filters.clientId,
    });

    const byClient = data.byClient;

    const totalMinutes = data.rows.reduce((a, r) => a + r.minutes, 0);
    const totalHours = Number((totalMinutes / 60).toFixed(2));

    const byCarer = data.summary.map((s) => ({
      carerId: s.carerId,
      carerName: s.carerName,
      visitCount: s.visitCount,
      totalHours: Number((s.totalMinutes / 60).toFixed(2)),
    }));

    return {
      totalHours,
      visitCount: data.rows.length,
      rows: data.rows.map((r) => ({
        ...r,
        hours: Number((r.minutes / 60).toFixed(2)),
      })),
      byCarer,
      byClient: byClient.map((c) => ({
        ...c,
        totalHours: Number((c.totalMinutes / 60).toFixed(2)),
      })),
      filters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        clientId: filters.clientId ?? null,
        carerId: filters.carerId ?? null,
      },
    };
  },

  async getIncidentsReport(organizationId: string, filters: IncidentReportFilters) {
    const createdAt = incidentCreatedFilter(filters);
    const where: Prisma.IncidentWhereInput = {
      organizationId,
      createdAt,
    };
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.severity && Object.values(IncidentSeverity).includes(filters.severity as IncidentSeverity)) {
      where.severity = filters.severity as IncidentSeverity;
    }
    if (filters.status && Object.values(IncidentStatus).includes(filters.status as IncidentStatus)) {
      where.status = filters.status as IncidentStatus;
    }

    const [rows, bySeverity, byStatus] = await Promise.all([
      prisma.incident.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          reportedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 2000,
      }),
      prisma.incident.groupBy({
        by: ['severity'],
        where,
        _count: { _all: true },
      }),
      prisma.incident.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    return {
      total: rows.length,
      rows: rows.map((i) => ({
        id: i.id,
        createdAt: i.createdAt.toISOString(),
        clientId: i.clientId,
        clientName: i.client.name,
        category: i.category,
        severity: i.severity,
        status: i.status,
        safeguardingFlag: i.safeguardingFlag,
        reportedByName: i.reportedBy.name,
        detailsSnippet: i.details ? i.details.slice(0, 200) : '',
      })),
      bySeverity: Object.fromEntries(bySeverity.map((g) => [g.severity, g._count._all])),
      byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count._all])),
      filters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        clientId: filters.clientId ?? null,
        carerId: null,
        severity: filters.severity ?? null,
        status: filters.status ?? null,
      },
    };
  },

  async getPayrollSummaryReport(organizationId: string, filters: OrgReportFilters) {
    let from = parseQueryDateFrom(filters.from);
    let to = parseQueryDateTo(filters.to);
    if (!from && !to) {
      to = new Date();
      to.setHours(23, 59, 59, 999);
      from = subDays(to, 90);
      from.setHours(0, 0, 0, 0);
    } else {
      if (!from) from = new Date(2000, 0, 1);
      if (!to) {
        to = new Date();
        to.setHours(23, 59, 59, 999);
      }
    }

    const where: Prisma.PayslipWhereInput = {
      organizationId,
      ...payslipPeriodOverlap(from, to),
    };
    if (filters.carerId) where.carerId = filters.carerId;

    const payslips = await prisma.payslip.findMany({
      where,
      include: {
        carer: { select: { id: true, name: true, email: true } },
        rateCard: { select: { id: true, name: true } },
      },
      orderBy: [{ periodStart: 'desc' }, { carer: { name: 'asc' } }],
      take: 2000,
    });

    const totals = payslips.reduce(
      (acc, p) => {
        acc.count += 1;
        acc.grossPay += p.grossPay;
        acc.hoursWorked += p.hoursWorked;
        acc.netPayTotal += p.netPayTotal;
        acc.mileagePay += p.mileagePay;
        return acc;
      },
      { count: 0, grossPay: 0, hoursWorked: 0, netPayTotal: 0, mileagePay: 0 }
    );

    const byCarerMap = new Map<
      string,
      { carerId: string; carerName: string; payslipCount: number; grossPay: number; hoursWorked: number; netPayTotal: number }
    >();
    for (const p of payslips) {
      const cur = byCarerMap.get(p.carerId) || {
        carerId: p.carerId,
        carerName: p.carer.name,
        payslipCount: 0,
        grossPay: 0,
        hoursWorked: 0,
        netPayTotal: 0,
      };
      cur.payslipCount += 1;
      cur.grossPay += p.grossPay;
      cur.hoursWorked += p.hoursWorked;
      cur.netPayTotal += p.netPayTotal;
      byCarerMap.set(p.carerId, cur);
    }
    const byCarer = Array.from(byCarerMap.values()).sort((a, b) => b.grossPay - a.grossPay);

    return {
      totals: {
        ...totals,
        grossPay: Number(totals.grossPay.toFixed(2)),
        hoursWorked: Number(totals.hoursWorked.toFixed(2)),
        netPayTotal: Number(totals.netPayTotal.toFixed(2)),
        mileagePay: Number(totals.mileagePay.toFixed(2)),
      },
      byCarer,
      payslips: payslips.map((p) => ({
        id: p.id,
        carerId: p.carerId,
        carerName: p.carer.name,
        periodStart: p.periodStart.toISOString(),
        periodEnd: p.periodEnd.toISOString(),
        status: p.status,
        hoursWorked: p.hoursWorked,
        grossPay: p.grossPay,
        netPayTotal: p.netPayTotal,
        mileagePay: p.mileagePay,
        rateCardName: p.rateCard?.name ?? '',
      })),
      filters: {
        from: filters.from ?? from.toISOString().slice(0, 10),
        to: filters.to ?? to.toISOString().slice(0, 10),
        clientId: null,
        carerId: filters.carerId ?? null,
      },
    };
  },
};
