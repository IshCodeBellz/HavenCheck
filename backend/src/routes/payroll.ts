import express from 'express';
import { PayslipStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { getUserOrganizationId } from '../lib/organization';
import { resolveRateCard } from '../lib/rateCardResolve';

const router = express.Router();

const generatePayslipsSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  carerId: z.string().optional(),
  rateCardId: z.string().optional(),
});

const expenseRowSchema = z.object({
  description: z.string().trim().min(1),
  amount: z.number().nonnegative(),
});

const updatePayslipSchema = z.object({
  status: z.nativeEnum(PayslipStatus).optional(),
  expenseReimbursements: z.array(expenseRowSchema).optional(),
});

const mileageOverrideSchema = z.object({
  mileageMilesOverride: z.number().nonnegative().nullable(),
});

function escapeCsvField(value: string | number): string {
  const str = String(value ?? '');
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toMiles(meters: number): number {
  return meters * 0.000621371;
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sumExpenseAmounts(rows: { amount: number }[]): number {
  return Number(rows.reduce((acc, r) => acc + (Number.isFinite(r.amount) ? r.amount : 0), 0).toFixed(2));
}

function canTransitionPayslipStatus(from: PayslipStatus, to: PayslipStatus): boolean {
  if (from === to) return true;
  if (from === PayslipStatus.DRAFT && (to === PayslipStatus.FINALIZED || to === PayslipStatus.PAID)) return true;
  if (from === PayslipStatus.FINALIZED && to === PayslipStatus.PAID) return true;
  return false;
}

async function requireOrgId(req: AuthRequest, res: express.Response): Promise<string | null> {
  const organizationId = await getUserOrganizationId(req.userId!);
  if (!organizationId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    return null;
  }
  return organizationId;
}

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN, UserRole.MANAGER));

router.get('/payslips', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payslips = await prisma.payslip.findMany({
      where: {
        organizationId,
        carerId: (req.query.carerId as string | undefined) ?? undefined,
      },
      include: {
        carer: { select: { id: true, name: true, email: true } },
        rateCard: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payslips);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/payslips/generate', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payload = generatePayslipsSchema.parse(req.body);
    const periodStart = new Date(payload.periodStart);
    const periodEnd = new Date(payload.periodEnd);

    const visits = await prisma.visit.findMany({
      where: {
        client: { organizationId },
        status: 'COMPLETED',
        clockInTime: { not: null },
        clockOutTime: { not: null },
        scheduledStart: { gte: periodStart, lte: periodEnd },
        carerId: payload.carerId,
      },
      include: {
        carer: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, latitude: true, longitude: true } },
      },
      orderBy: [{ carerId: 'asc' }, { scheduledStart: 'asc' }],
    });

    const byCarer = new Map<string, typeof visits>();
    for (const visit of visits) {
      const group = byCarer.get(visit.carerId) || [];
      group.push(visit);
      byCarer.set(visit.carerId, group);
    }

    const createdPayslips = [];
    for (const [carerId, carerVisits] of byCarer.entries()) {
      const lineItems: any[] = [];
      let totalHours = 0;
      let totalMileageMiles = 0;
      let grossPay = 0;
      let totalMileagePay = 0;
      let totalHolidayAccruedHours = 0;
      let selectedRateCardId: string | null = null;

      for (const visit of carerVisits) {
        const rateCard = await resolveRateCard({
          organizationId,
          clientId: visit.clientId,
          at: visit.scheduledStart ?? visit.clockInTime!,
          explicitRateCardId: payload.rateCardId,
        });
        if (!rateCard) continue;
        selectedRateCardId = selectedRateCardId ?? rateCard.id;

        const hoursWorked = Math.max(0, (visit.clockOutTime!.getTime() - visit.clockInTime!.getTime()) / 3600000);
        totalHours += hoursWorked;
        const basePay = hoursWorked * rateCard.payrollHourlyRate;

        let mileageMiles = 0;
        let mileageSource: 'OVERRIDE' | 'GPS' | 'NONE' = 'NONE';
        if (visit.mileageMilesOverride != null && visit.mileageMilesOverride >= 0) {
          mileageMiles = visit.mileageMilesOverride;
          mileageSource = 'OVERRIDE';
        } else if (
          visit.client.latitude != null &&
          visit.client.longitude != null &&
          visit.clockInLat != null &&
          visit.clockInLng != null
        ) {
          mileageMiles += toMiles(
            distanceMeters(visit.clockInLat, visit.clockInLng, visit.client.latitude, visit.client.longitude)
          );
          mileageSource = 'GPS';
        }
        if (
          visit.mileageMilesOverride == null &&
          visit.client.latitude != null &&
          visit.client.longitude != null &&
          visit.clockOutLat != null &&
          visit.clockOutLng != null
        ) {
          mileageMiles += toMiles(
            distanceMeters(visit.client.latitude, visit.client.longitude, visit.clockOutLat, visit.clockOutLng)
          );
          if (mileageSource === 'NONE') mileageSource = 'GPS';
        }

        totalMileageMiles += mileageMiles;
        const mileagePay = mileageMiles * rateCard.mileageRatePerMile;
        totalMileagePay += mileagePay;

        const holidayAccrualHours = hoursWorked * rateCard.holidayAccrualRate;
        totalHolidayAccruedHours += holidayAccrualHours;
        grossPay += basePay + mileagePay;

        lineItems.push({
          visitId: visit.id,
          clientName: visit.client.name,
          scheduledStart: visit.scheduledStart?.toISOString() ?? null,
          hoursWorked: Number(hoursWorked.toFixed(2)),
          hourlyRate: Number(rateCard.payrollHourlyRate.toFixed(2)),
          basePay: Number(basePay.toFixed(2)),
          mileageMiles: Number(mileageMiles.toFixed(2)),
          mileageRatePerMile: Number(rateCard.mileageRatePerMile.toFixed(2)),
          mileagePay: Number(mileagePay.toFixed(2)),
          holidayAccrualHours: Number(holidayAccrualHours.toFixed(2)),
          mileageSource,
        });
      }

      if (lineItems.length === 0) continue;
      const grossRounded = Number(grossPay.toFixed(2));
      const payslip = await prisma.payslip.create({
        data: {
          organizationId,
          carerId,
          rateCardId: selectedRateCardId,
          periodStart,
          periodEnd,
          status: PayslipStatus.DRAFT,
          hoursWorked: Number(totalHours.toFixed(2)),
          mileageMiles: Number(totalMileageMiles.toFixed(2)),
          mileagePay: Number(totalMileagePay.toFixed(2)),
          holidayAccruedHours: Number(totalHolidayAccruedHours.toFixed(2)),
          grossPay: grossRounded,
          expenseReimbursements: [],
          expenseReimbursementTotal: 0,
          netPayTotal: grossRounded,
          lineItems,
        },
      });
      createdPayslips.push(payslip);
    }

    res.status(201).json({ created: createdPayslips.length, payslips: createdPayslips });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/payslips/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payslip = await prisma.payslip.findFirst({
      where: { id: req.params.id, organizationId },
      include: {
        carer: { select: { id: true, name: true, email: true } },
        rateCard: { select: { id: true, name: true, mileageRatePerMile: true, payrollHourlyRate: true } },
      },
    });
    if (!payslip) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Payslip not found' });
    }
    res.json(payslip);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/payslips/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payload = updatePayslipSchema.parse(req.body ?? {});
    const existing = await prisma.payslip.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Payslip not found' });
    }
    if (existing.status === PayslipStatus.PAID) {
      return res.status(400).json({ error: 'LOCKED', message: 'Paid payslips cannot be changed' });
    }

    if (payload.status && !canTransitionPayslipStatus(existing.status, payload.status)) {
      return res.status(400).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot change payslip status from ${existing.status} to ${payload.status}`,
      });
    }

    if (payload.expenseReimbursements !== undefined && existing.status !== PayslipStatus.DRAFT) {
      return res.status(400).json({
        error: 'LOCKED',
        message: 'Expense reimbursements can only be edited while the payslip is in draft',
      });
    }

    if (payload.status === undefined && payload.expenseReimbursements === undefined) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No updates provided' });
    }

    const data: {
      status?: PayslipStatus;
      expenseReimbursements?: object;
      expenseReimbursementTotal?: number;
      netPayTotal?: number;
    } = {};
    if (payload.status !== undefined) {
      data.status = payload.status;
    }
    if (payload.expenseReimbursements !== undefined) {
      const expenseReimbursementTotal = sumExpenseAmounts(payload.expenseReimbursements);
      data.expenseReimbursements = payload.expenseReimbursements;
      data.expenseReimbursementTotal = expenseReimbursementTotal;
      data.netPayTotal = Number((existing.grossPay + expenseReimbursementTotal).toFixed(2));
    }

    const payslip = await prisma.payslip.update({
      where: { id: existing.id },
      data,
      include: {
        carer: { select: { id: true, name: true, email: true } },
        rateCard: { select: { id: true, name: true } },
      },
    });
    res.json(payslip);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/visits/:visitId/mileage-override', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payload = mileageOverrideSchema.parse(req.body ?? {});
    const visit = await prisma.visit.findFirst({
      where: { id: req.params.visitId, client: { organizationId } },
    });
    if (!visit) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Visit not found' });
    }
    const updated = await prisma.visit.update({
      where: { id: visit.id },
      data: { mileageMilesOverride: payload.mileageMilesOverride },
    });
    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/payslips/:id/export/csv', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payslip = await prisma.payslip.findFirst({
      where: { id: req.params.id, organizationId },
      include: { carer: { select: { id: true, name: true, email: true } } },
    });
    if (!payslip) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Payslip not found' });
    }

    const lineItems = Array.isArray(payslip.lineItems) ? payslip.lineItems : [];
    const header = [
      'PayslipId',
      'CarerName',
      'CarerEmail',
      'PeriodStart',
      'PeriodEnd',
      'VisitId',
      'ClientName',
      'HoursWorked',
      'HourlyRate',
      'BasePay',
      'MileageMiles',
      'MileageSource',
      'MileageRate',
      'MileagePay',
      'HolidayAccruedHours',
      'ExpenseReimbursementTotal',
      'NetPayTotal',
    ].join(',');
    const rows = lineItems.map((item: any) =>
      [
        payslip.id,
        payslip.carer.name,
        payslip.carer.email,
        payslip.periodStart.toISOString().slice(0, 10),
        payslip.periodEnd.toISOString().slice(0, 10),
        item.visitId ?? '',
        item.clientName ?? '',
        item.hoursWorked ?? 0,
        item.hourlyRate ?? 0,
        item.basePay ?? 0,
        item.mileageMiles ?? 0,
        item.mileageSource ?? '',
        item.mileageRatePerMile ?? 0,
        item.mileagePay ?? 0,
        item.holidayAccrualHours ?? 0,
        payslip.expenseReimbursementTotal,
        payslip.netPayTotal,
      ]
        .map((value) => escapeCsvField(value))
        .join(',')
    );
    const csv = [header, ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslip.id}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

export default router;
