import express from 'express';
import { AuthRequest } from '../middleware/auth';
import { getUserOrganizationId } from '../lib/organization';
import { complianceService, resolveComplianceRange } from '../services/complianceService';
import { auditLogService } from '../services/auditLogService';

const router = express.Router();

function parseInclude(raw: unknown): { incidents: boolean; medications: boolean; carePlans: boolean } {
  if (raw === undefined || raw === null || raw === '') {
    return { incidents: true, medications: true, carePlans: true };
  }
  const parts = String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return {
    incidents: parts.includes('incidents') || parts.includes('all'),
    medications: parts.includes('medications') || parts.includes('meds') || parts.includes('all'),
    carePlans: parts.includes('care_plans') || parts.includes('careplans') || parts.includes('all'),
  };
}

router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }
    const range = resolveComplianceRange(req.query.from as string, req.query.to as string);
    const dashboard = await complianceService.getDashboard(organizationId, range);
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/inspection-pack', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }
    const range = resolveComplianceRange(req.query.from as string, req.query.to as string);
    let include = parseInclude(req.query.include);
    if (!include.incidents && !include.medications && !include.carePlans) {
      include = { incidents: true, medications: true, carePlans: true };
    }

    const format = String(req.query.format || 'csv').toLowerCase() === 'pdf' ? 'pdf' : 'csv';

    if (format === 'pdf') {
      const buf = await complianceService.buildInspectionPdf(organizationId, range);
      const fname = `inspection-pack-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.pdf`;
      await auditLogService.log({
        organizationId,
        module: 'compliance',
        action: 'INSPECTION_PACK_EXPORT',
        entityType: 'ComplianceExport',
        actorId: req.userId!,
        actorRole: req.userRole,
        route: req.path,
        method: req.method,
        metadata: {
          format,
          include,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
      res.send(buf);
    } else {
      const activeCount = [include.incidents, include.medications, include.carePlans].filter(Boolean).length;
      if (activeCount === 1) {
        let body = '';
        let filename = 'export.csv';
        if (include.incidents) {
          const rows = await complianceService.fetchIncidentsForExport(organizationId, range);
          body = complianceService.incidentsToCsv(rows);
          filename = `incidents-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
        } else if (include.medications) {
          const rows = await complianceService.fetchMedicationEventsForExport(organizationId, range);
          body = complianceService.medicationEventsToCsv(rows);
          filename = `medication_logs-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
        } else {
          const rows = await complianceService.fetchCarePlansForExport(organizationId, range);
          body = complianceService.carePlansToCsv(rows);
          filename = `care_plans-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.csv`;
        }
        await auditLogService.log({
          organizationId,
          module: 'compliance',
          action: 'INSPECTION_PACK_EXPORT',
          entityType: 'ComplianceExport',
          actorId: req.userId!,
          actorRole: req.userRole,
          route: req.path,
          method: req.method,
          metadata: {
            format,
            include,
            from: range.from.toISOString(),
            to: range.to.toISOString(),
          },
        });
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send('\uFEFF' + body);
      } else {
        const buf = await complianceService.buildInspectionZip(organizationId, range, include);
        const fname = `inspection-pack-${range.from.toISOString().slice(0, 10)}-${range.to.toISOString().slice(0, 10)}.zip`;
        await auditLogService.log({
          organizationId,
          module: 'compliance',
          action: 'INSPECTION_PACK_EXPORT',
          entityType: 'ComplianceExport',
          actorId: req.userId!,
          actorRole: req.userRole,
          route: req.path,
          method: req.method,
          metadata: {
            format,
            include,
            from: range.from.toISOString(),
            to: range.to.toISOString(),
          },
        });
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
        res.send(buf);
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

export default router;
