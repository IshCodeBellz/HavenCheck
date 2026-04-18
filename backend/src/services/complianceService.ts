import {
  CarePlanStatus,
  IncidentStatus,
  MedicationEventStatus,
  Prisma,
  VisitStatus,
} from '@prisma/client';
import { subDays } from 'date-fns';
import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import { prisma } from '../lib/prisma';
import { escapeCsvField, parseQueryDateFrom, parseQueryDateTo } from '../lib/marReports';

export type ComplianceDateRange = { from: Date; to: Date };

const PDF_ROW_CAP = 400;

export function resolveComplianceRange(fromStr?: string, toStr?: string): ComplianceDateRange {
  const to = parseQueryDateTo(toStr || '') ?? new Date();
  const from =
    parseQueryDateFrom(fromStr || '') ??
    (() => {
      const d = subDays(to, 30);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
  return { from, to };
}

function visitDateFilter(range: ComplianceDateRange): Prisma.DateTimeNullableFilter {
  return {
    gte: range.from,
    lte: range.to,
  };
}

export const complianceService = {
  async getDashboard(organizationId: string, range: ComplianceDateRange) {
    const visitBase = {
      client: { organizationId },
      scheduledStart: visitDateFilter(range),
    } satisfies Prisma.VisitWhereInput;

    const [
      incidentsInPeriod,
      incidentsOpen,
      incidentsSafeguarding,
      medAdministered,
      medOmitted,
      visitsMissed,
      visitsIncomplete,
      visitsLate,
      medAlertsUnacked,
      highRiskAssessments,
      overdueCarePlanReviews,
    ] = await Promise.all([
      prisma.incident.count({
        where: { organizationId, createdAt: { gte: range.from, lte: range.to } },
      }),
      prisma.incident.count({
        where: { organizationId, status: { not: IncidentStatus.CLOSED } },
      }),
      prisma.incident.count({
        where: { organizationId, safeguardingFlag: true, status: { not: IncidentStatus.CLOSED } },
      }),
      prisma.medicationEvent.count({
        where: {
          organizationId,
          deletedAt: null,
          status: MedicationEventStatus.ADMINISTERED,
          administeredAt: { gte: range.from, lte: range.to },
        },
      }),
      prisma.medicationEvent.count({
        where: {
          organizationId,
          deletedAt: null,
          status: MedicationEventStatus.OMITTED,
          administeredAt: { gte: range.from, lte: range.to },
        },
      }),
      prisma.visit.count({
        where: { ...visitBase, status: VisitStatus.MISSED },
      }),
      prisma.visit.count({
        where: { ...visitBase, status: VisitStatus.INCOMPLETE },
      }),
      prisma.visit.count({
        where: { ...visitBase, status: VisitStatus.LATE },
      }),
      prisma.medicationAlert.count({
        where: {
          organizationId,
          acknowledgedAt: null,
          createdAt: { gte: range.from, lte: range.to },
        },
      }),
      prisma.riskAssessment.count({
        where: {
          organizationId,
          riskLevel: 'HIGH',
          reviewedAt: { gte: range.from, lte: range.to },
        },
      }),
      prisma.carePlan.count({
        where: {
          organizationId,
          status: CarePlanStatus.ACTIVE,
          reviewDate: { lt: new Date() },
        },
      }),
    ]);

    const medTotal = medAdministered + medOmitted;
    const medicationComplianceRate =
      medTotal === 0 ? null : Math.round((medAdministered / medTotal) * 1000) / 10;

    const [incidentsBySeverity, incidentsByStatus] = await Promise.all([
      prisma.incident.groupBy({
        by: ['severity'],
        where: { organizationId, createdAt: { gte: range.from, lte: range.to } },
        _count: { _all: true },
      }),
      prisma.incident.groupBy({
        by: ['status'],
        where: { organizationId, createdAt: { gte: range.from, lte: range.to } },
        _count: { _all: true },
      }),
    ]);

    const recentIncidents = await prisma.incident.findMany({
      where: { organizationId, createdAt: { gte: range.from, lte: range.to } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        category: true,
        severity: true,
        status: true,
        safeguardingFlag: true,
        createdAt: true,
        client: { select: { name: true } },
      },
    });

    return {
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      incidents: {
        inPeriod: incidentsInPeriod,
        open: incidentsOpen,
        safeguardingOpen: incidentsSafeguarding,
        bySeverity: Object.fromEntries(incidentsBySeverity.map((r) => [r.severity, r._count._all])),
        byStatus: Object.fromEntries(incidentsByStatus.map((r) => [r.status, r._count._all])),
        recent: recentIncidents,
      },
      medication: {
        administered: medAdministered,
        omitted: medOmitted,
        complianceRatePercent: medicationComplianceRate,
      },
      visits: {
        missed: visitsMissed,
        incomplete: visitsIncomplete,
        late: visitsLate,
      },
      riskAlerts: {
        unacknowledgedMedicationAlerts: medAlertsUnacked,
        highRiskAssessmentsInPeriod: highRiskAssessments,
        overdueActiveCarePlanReviews: overdueCarePlanReviews,
      },
    };
  },

  async fetchIncidentsForExport(organizationId: string, range: ComplianceDateRange) {
    return prisma.incident.findMany({
      where: { organizationId, createdAt: { gte: range.from, lte: range.to } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        client: { select: { name: true } },
        reportedBy: { select: { name: true, email: true } },
      },
    });
  },

  async fetchMedicationEventsForExport(organizationId: string, range: ComplianceDateRange) {
    return prisma.medicationEvent.findMany({
      where: {
        organizationId,
        deletedAt: null,
        administeredAt: { gte: range.from, lte: range.to },
      },
      orderBy: { administeredAt: 'desc' },
      take: 10000,
      include: {
        client: { select: { name: true } },
        medication: { select: { name: true, dosage: true } },
        visit: { select: { id: true, scheduledStart: true, status: true } },
        recordedBy: { select: { name: true } },
      },
    });
  },

  async fetchCarePlansForExport(organizationId: string, range: ComplianceDateRange) {
    return prisma.carePlan.findMany({
      where: {
        organizationId,
        OR: [{ createdAt: { gte: range.from, lte: range.to } }, { updatedAt: { gte: range.from, lte: range.to } }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 2000,
      include: {
        client: { select: { name: true } },
        currentVersion: {
          include: { sections: { orderBy: [{ orderIndex: 'asc' }] } },
        },
      },
    });
  },

  incidentsToCsv(
    rows: Array<{
      id: string;
      createdAt: Date;
      category: string;
      severity: string;
      status: string;
      safeguardingFlag: boolean;
      details: string | null;
      client: { name: string };
      reportedBy: { name: string; email: string };
    }>
  ): string {
    const headers = [
      'id',
      'createdAt',
      'client',
      'category',
      'severity',
      'status',
      'safeguarding',
      'reportedBy',
      'details',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(
        [
          escapeCsvField(r.id),
          escapeCsvField(r.createdAt.toISOString()),
          escapeCsvField(r.client.name),
          escapeCsvField(r.category),
          escapeCsvField(r.severity),
          escapeCsvField(r.status),
          escapeCsvField(r.safeguardingFlag ? 'yes' : 'no'),
          escapeCsvField(r.reportedBy.name),
          escapeCsvField(r.details),
        ].join(',')
      );
    }
    return lines.join('\n');
  },

  medicationEventsToCsv(
    rows: Array<{
      id: string;
      administeredAt: Date;
      status: string;
      reasonCode: string | null;
      note: string | null;
      client: { name: string };
      medication: { name: string; dosage: string | null };
      visit: { id: string; scheduledStart: Date | null; status: string };
      recordedBy: { name: string };
    }>
  ): string {
    const headers = [
      'id',
      'administeredAt',
      'client',
      'medication',
      'dosage',
      'status',
      'reasonCode',
      'note',
      'visitId',
      'visitStatus',
      'visitScheduled',
      'recordedBy',
    ];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(
        [
          escapeCsvField(r.id),
          escapeCsvField(r.administeredAt.toISOString()),
          escapeCsvField(r.client.name),
          escapeCsvField(r.medication.name),
          escapeCsvField(r.medication.dosage),
          escapeCsvField(r.status),
          escapeCsvField(r.reasonCode),
          escapeCsvField(r.note),
          escapeCsvField(r.visit.id),
          escapeCsvField(r.visit.status),
          escapeCsvField(r.visit.scheduledStart?.toISOString() ?? ''),
          escapeCsvField(r.recordedBy.name),
        ].join(',')
      );
    }
    return lines.join('\n');
  },

  carePlansToCsv(
    rows: Array<{
      id: string;
      status: string;
      reviewDate: Date | null;
      updatedAt: Date;
      client: { name: string };
      currentVersion: {
        sections: Array<{ sectionType: string; title: string; body: string; orderIndex: number }>;
      } | null;
    }>
  ): string {
    const headers = ['id', 'client', 'status', 'reviewDate', 'updatedAt', 'sections'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const sections =
        r.currentVersion?.sections
          .map((s) => `[${s.sectionType}] ${s.title}: ${s.body}`)
          .join('\n---\n') ?? '';
      lines.push(
        [
          escapeCsvField(r.id),
          escapeCsvField(r.client.name),
          escapeCsvField(r.status),
          escapeCsvField(r.reviewDate?.toISOString() ?? ''),
          escapeCsvField(r.updatedAt.toISOString()),
          escapeCsvField(sections),
        ].join(',')
      );
    }
    return lines.join('\n');
  },

  async buildInspectionZip(
    organizationId: string,
    range: ComplianceDateRange,
    include: { incidents: boolean; medications: boolean; carePlans: boolean }
  ): Promise<Buffer> {
    const [incRows, medRows, planRows] = await Promise.all([
      include.incidents ? this.fetchIncidentsForExport(organizationId, range) : Promise.resolve([]),
      include.medications ? this.fetchMedicationEventsForExport(organizationId, range) : Promise.resolve([]),
      include.carePlans ? this.fetchCarePlansForExport(organizationId, range) : Promise.resolve([]),
    ]);

    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<void>((resolve, reject) => {
      archive.on('end', () => resolve());
      archive.on('error', reject);
    });

    if (include.incidents) {
      archive.append(this.incidentsToCsv(incRows as any), { name: 'incidents.csv' });
    }
    if (include.medications) {
      archive.append(this.medicationEventsToCsv(medRows as any), { name: 'medication_logs.csv' });
    }
    if (include.carePlans) {
      archive.append(this.carePlansToCsv(planRows as any), { name: 'care_plans.csv' });
    }

    void archive.finalize();
    await done;
    return Buffer.concat(chunks);
  },

  async buildInspectionPdf(organizationId: string, range: ComplianceDateRange): Promise<Buffer> {
    const [incRows, medRows, planRows] = await Promise.all([
      this.fetchIncidentsForExport(organizationId, range),
      this.fetchMedicationEventsForExport(organizationId, range),
      this.fetchCarePlansForExport(organizationId, range),
    ]);

    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const title = (t: string) => {
      doc.moveDown(0.6);
      doc.fontSize(13).font('Helvetica-Bold').text(t, { underline: true });
      doc.font('Helvetica').fontSize(9);
    };

    doc.fontSize(16).font('Helvetica-Bold').text('HavenCheck inspection pack', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Organisation: ${organizationId}`, { align: 'center' });
    doc.text(`Period: ${range.from.toISOString().slice(0, 10)} to ${range.to.toISOString().slice(0, 10)}`, {
      align: 'center',
    });
    doc.text(`Generated: ${new Date().toISOString()}`, { align: 'center' });

    title(`Incidents (${incRows.length})`);
    const incSlice = incRows.slice(0, PDF_ROW_CAP);
    for (const r of incSlice) {
      doc.moveDown(0.35);
      doc.text(
        `${r.createdAt.toISOString()} | ${r.client.name} | ${r.severity} | ${r.status} | ${r.category}` +
          (r.safeguardingFlag ? ' | SAFEGUARDING' : '')
      );
      if (r.details) doc.fontSize(8).text(String(r.details).slice(0, 500), { indent: 8 });
      doc.fontSize(9);
    }
    if (incRows.length > PDF_ROW_CAP) {
      doc.moveDown(0.5).font('Helvetica-Oblique').text(`… ${incRows.length - PDF_ROW_CAP} further incidents not shown.`);
    }

    doc.addPage();
    title(`Medication logs (${medRows.length})`);
    const medSlice = medRows.slice(0, PDF_ROW_CAP);
    for (const r of medSlice) {
      doc.moveDown(0.35);
      doc.text(
        `${r.administeredAt.toISOString()} | ${r.client.name} | ${r.medication.name} | ${r.status}` +
          (r.reasonCode ? ` | ${r.reasonCode}` : '')
      );
    }
    if (medRows.length > PDF_ROW_CAP) {
      doc.moveDown(0.5).font('Helvetica-Oblique').text(`… ${medRows.length - PDF_ROW_CAP} further events not shown.`);
    }

    doc.addPage();
    title(`Care plans (${planRows.length})`);
    const planSlice = planRows.slice(0, 200);
    for (const r of planSlice) {
      doc.moveDown(0.5);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(`${r.client.name} — ${r.status} (updated ${r.updatedAt.toISOString().slice(0, 10)})`);
      doc.font('Helvetica').fontSize(9);
      const body =
        r.currentVersion?.sections.map((s) => `${s.title}: ${s.body}`).join('\n\n') ?? '(no published sections)';
      doc.text(body.slice(0, 3500) + (body.length > 3500 ? '\n…(truncated)' : ''), { align: 'left' });
    }
    if (planRows.length > 200) {
      doc.moveDown(0.5).font('Helvetica-Oblique').text(`… ${planRows.length - 200} further care plans not shown.`);
    }

    doc.end();
    return done;
  },
};
