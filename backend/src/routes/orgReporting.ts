import express from 'express';
import { AuthRequest } from '../middleware/auth';
import { csvFromTable } from '../lib/reportingCsv';
import { reportingService, OrgReportFilters, IncidentReportFilters } from '../services/reportingService';

type ResolveOrg = (req: AuthRequest, res: express.Response) => Promise<string | null>;

function pickOrgFilters(query: express.Request['query']): OrgReportFilters {
  const q = query as Record<string, string | undefined>;
  return {
    from: q.from,
    to: q.to,
    clientId: q.clientId,
    carerId: q.carerId,
  };
}

function pickIncidentFilters(query: express.Request['query']): IncidentReportFilters {
  const q = query as Record<string, string | undefined>;
  return {
    ...pickOrgFilters(query),
    severity: q.severity,
    status: q.status,
  };
}

function sendCsv(res: express.Response, filename: string, body: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(body);
}

/** Paths under `/reports/ops/` avoid colliding with legacy handlers (e.g. `/admin/reports/medication-compliance`). */
export function registerOrgReportingRoutes(router: express.Router, resolveOrg: ResolveOrg) {
  router.get('/reports/ops/missed-visits', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getMissedVisitsReport(organizationId, pickOrgFilters(req.query));
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  router.get('/reports/ops/missed-visits/export', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getMissedVisitsReport(organizationId, pickOrgFilters(req.query));
      const csv = csvFromTable(
        ['visitId', 'clientName', 'carerName', 'scheduledStart', 'scheduledEnd'],
        data.rows.map((r) => [r.visitId, r.clientName, r.carerName, r.scheduledStart, r.scheduledEnd])
      );
      const slug = `missed-visits-${organizationId.slice(0, 8)}`;
      sendCsv(res, `${slug}.csv`, csv);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  router.get('/reports/ops/medication-compliance', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getMedicationComplianceReport(organizationId, pickOrgFilters(req.query));
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  router.get('/reports/ops/medication-compliance/export', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getMedicationComplianceReport(organizationId, pickOrgFilters(req.query));
      const summary = csvFromTable(
        ['metric', 'value'],
        [
          ['totalEvents', data.summary.totalEvents],
          ['administered', data.summary.administered],
          ['omitted', data.summary.omitted],
          ['administeredRate', Number(data.summary.administeredRate.toFixed(4))],
        ]
      );
      const byClient = csvFromTable(
        ['clientId', 'clientName', 'administered', 'omitted', 'complianceRate'],
        data.byClient.map((c) => [
          c.clientId,
          c.clientName,
          c.administered,
          c.omitted,
          c.complianceRate == null ? '' : Number(c.complianceRate.toFixed(4)),
        ])
      );
      const reasons = csvFromTable(
        ['reason', 'count'],
        data.topOmissionReasons.map((r) => [r.reason, r.count])
      );
      const csv = [summary, byClient, reasons].join('\r\n\r\n');
      sendCsv(res, `medication-compliance-${organizationId.slice(0, 8)}.csv`, csv);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  router.get('/reports/ops/hours-delivered', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getHoursDeliveredReport(organizationId, pickOrgFilters(req.query));
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  router.get('/reports/ops/hours-delivered/export', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getHoursDeliveredReport(organizationId, pickOrgFilters(req.query));
      const csv = csvFromTable(
        ['visitId', 'clientName', 'carerName', 'scheduledStart', 'clockInTime', 'clockOutTime', 'hours'],
        data.rows.map((r) => [
          r.visitId,
          r.clientName,
          r.carerName,
          r.scheduledStart,
          r.clockInTime,
          r.clockOutTime,
          r.hours,
        ])
      );
      sendCsv(res, `hours-delivered-${organizationId.slice(0, 8)}.csv`, csv);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  router.get('/reports/ops/incidents', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getIncidentsReport(organizationId, pickIncidentFilters(req.query));
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  router.get('/reports/ops/incidents/export', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getIncidentsReport(organizationId, pickIncidentFilters(req.query));
      const csv = csvFromTable(
        ['id', 'createdAt', 'clientName', 'category', 'severity', 'status', 'safeguardingFlag', 'reportedByName', 'detailsSnippet'],
        data.rows.map((r) => [
          r.id,
          r.createdAt,
          r.clientName,
          r.category,
          r.severity,
          r.status,
          r.safeguardingFlag ? 'true' : 'false',
          r.reportedByName,
          r.detailsSnippet,
        ])
      );
      sendCsv(res, `incidents-${organizationId.slice(0, 8)}.csv`, csv);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  router.get('/reports/ops/payroll-summary', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getPayrollSummaryReport(organizationId, pickOrgFilters(req.query));
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });

  router.get('/reports/ops/payroll-summary/export', async (req: AuthRequest, res) => {
    try {
      const organizationId = await resolveOrg(req, res);
      if (!organizationId) return;
      const data = await reportingService.getPayrollSummaryReport(organizationId, pickOrgFilters(req.query));
      const csv = csvFromTable(
        ['payslipId', 'carerName', 'periodStart', 'periodEnd', 'status', 'hoursWorked', 'grossPay', 'netPayTotal', 'mileagePay', 'rateCardName'],
        data.payslips.map((p) => [
          p.id,
          p.carerName,
          p.periodStart,
          p.periodEnd,
          p.status,
          p.hoursWorked,
          p.grossPay,
          p.netPayTotal,
          p.mileagePay,
          p.rateCardName,
        ])
      );
      sendCsv(res, `payroll-summary-${organizationId.slice(0, 8)}.csv`, csv);
    } catch (error: any) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
    }
  });
}
