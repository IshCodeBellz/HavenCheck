import express from 'express';
import { BillingRateType, InvoiceStatus, Prisma, UserRole } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { getUserOrganizationId } from '../lib/organization';
import { resolveRateCard } from '../lib/rateCardResolve';
import { adjustedUnitAmount } from '../lib/billingModifiers';

const router = express.Router();

const billingModifiersSchema = z
  .object({
    weekendHourlyMultiplier: z.number().positive().optional(),
  })
  .optional()
  .nullable();

const rateCardSchema = z.object({
  clientId: z.string().optional().nullable(),
  name: z.string().trim().min(1),
  contractRef: z.string().trim().optional().nullable(),
  billingRateType: z.nativeEnum(BillingRateType),
  billingHourlyRate: z.number().nonnegative().optional().nullable(),
  billingFixedRate: z.number().nonnegative().optional().nullable(),
  payrollHourlyRate: z.number().nonnegative(),
  mileageRatePerMile: z.number().nonnegative().optional(),
  holidayAccrualRate: z.number().nonnegative().optional(),
  billingModifiers: billingModifiersSchema,
  active: z.boolean().optional(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
});

const generateInvoicesSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  clientId: z.string().optional(),
  rateCardId: z.string().optional(),
  contractRef: z.string().optional(),
  dueDays: z.number().int().positive().max(90).optional().default(14),
  currency: z.string().min(3).max(3).optional().default('GBP'),
});

function escapeCsvField(value: string | number): string {
  const str = String(value ?? '');
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

async function requireOrgId(req: AuthRequest, res: express.Response): Promise<string | null> {
  const organizationId = await getUserOrganizationId(req.userId!);
  if (!organizationId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    return null;
  }
  return organizationId;
}

function canTransitionInvoiceStatus(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) return true;
  if (to === InvoiceStatus.VOID) return from === InvoiceStatus.DRAFT || from === InvoiceStatus.ISSUED;
  if (from === InvoiceStatus.DRAFT && to === InvoiceStatus.ISSUED) return true;
  if (from === InvoiceStatus.ISSUED && to === InvoiceStatus.PAID) return true;
  return false;
}

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN, UserRole.MANAGER));

router.get('/rate-cards', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;

    const cards = await prisma.rateCard.findMany({
      where: {
        organizationId,
        clientId: (req.query.clientId as string | undefined) ?? undefined,
        active: req.query.active === undefined ? undefined : req.query.active === 'true',
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(cards);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/rate-cards', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payload = rateCardSchema.parse(req.body);

    if (payload.billingRateType === BillingRateType.HOURLY && payload.billingHourlyRate == null) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'billingHourlyRate required for hourly rate cards' });
    }
    if (payload.billingRateType === BillingRateType.FIXED && payload.billingFixedRate == null) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'billingFixedRate required for fixed rate cards' });
    }

    const card = await prisma.rateCard.create({
      data: {
        organizationId,
        clientId: payload.clientId ?? null,
        name: payload.name,
        contractRef: payload.contractRef ?? null,
        billingRateType: payload.billingRateType,
        billingHourlyRate: payload.billingHourlyRate ?? null,
        billingFixedRate: payload.billingFixedRate ?? null,
        payrollHourlyRate: payload.payrollHourlyRate,
        mileageRatePerMile: payload.mileageRatePerMile ?? 0,
        holidayAccrualRate: payload.holidayAccrualRate ?? 0.1207,
        billingModifiers:
          payload.billingModifiers === undefined
            ? undefined
            : payload.billingModifiers === null
              ? Prisma.JsonNull
              : (payload.billingModifiers as Prisma.InputJsonValue),
        active: payload.active ?? true,
        effectiveFrom: payload.effectiveFrom ? new Date(payload.effectiveFrom) : null,
        effectiveTo: payload.effectiveTo ? new Date(payload.effectiveTo) : null,
      },
    });
    res.status(201).json(card);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/rate-cards/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payload = rateCardSchema.partial().parse(req.body ?? {});

    const existing = await prisma.rateCard.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Rate card not found' });
    }

    const nextType = payload.billingRateType ?? existing.billingRateType;
    const nextHourly = payload.billingHourlyRate === undefined ? existing.billingHourlyRate : payload.billingHourlyRate;
    const nextFixed = payload.billingFixedRate === undefined ? existing.billingFixedRate : payload.billingFixedRate;
    if (nextType === BillingRateType.HOURLY && nextHourly == null) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'billingHourlyRate required for hourly rate cards' });
    }
    if (nextType === BillingRateType.FIXED && nextFixed == null) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'billingFixedRate required for fixed rate cards' });
    }

    const card = await prisma.rateCard.update({
      where: { id: existing.id },
      data: {
        clientId: payload.clientId === undefined ? undefined : payload.clientId ?? null,
        name: payload.name,
        contractRef: payload.contractRef === undefined ? undefined : payload.contractRef ?? null,
        billingRateType: payload.billingRateType,
        billingHourlyRate: payload.billingHourlyRate === undefined ? undefined : payload.billingHourlyRate ?? null,
        billingFixedRate: payload.billingFixedRate === undefined ? undefined : payload.billingFixedRate ?? null,
        payrollHourlyRate: payload.payrollHourlyRate,
        mileageRatePerMile: payload.mileageRatePerMile,
        holidayAccrualRate: payload.holidayAccrualRate,
        billingModifiers:
          payload.billingModifiers === undefined
            ? undefined
            : payload.billingModifiers === null
              ? Prisma.JsonNull
              : (payload.billingModifiers as Prisma.InputJsonValue),
        active: payload.active,
        effectiveFrom: payload.effectiveFrom === undefined ? undefined : payload.effectiveFrom ? new Date(payload.effectiveFrom) : null,
        effectiveTo: payload.effectiveTo === undefined ? undefined : payload.effectiveTo ? new Date(payload.effectiveTo) : null,
      },
    });
    res.json(card);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/invoices', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const statusParam = req.query.status as string | undefined;
    const statusFilter =
      statusParam && Object.values(InvoiceStatus).includes(statusParam as InvoiceStatus)
        ? (statusParam as InvoiceStatus)
        : undefined;
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        clientId: (req.query.clientId as string | undefined) ?? undefined,
        status: statusFilter,
      },
      include: {
        client: { select: { id: true, name: true } },
        rateCard: { select: { id: true, name: true, billingRateType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/invoices/generate', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payload = generateInvoicesSchema.parse(req.body);
    const periodStart = new Date(payload.periodStart);
    const periodEnd = new Date(payload.periodEnd);

    const visits = await prisma.visit.findMany({
      where: {
        client: { organizationId },
        status: 'COMPLETED',
        clockInTime: { not: null },
        clockOutTime: { not: null },
        scheduledStart: { gte: periodStart, lte: periodEnd },
        clientId: payload.clientId,
      },
      include: {
        client: { select: { id: true, name: true } },
        carer: { select: { id: true, name: true } },
      },
      orderBy: [{ clientId: 'asc' }, { scheduledStart: 'asc' }],
    });

    const byClient = new Map<string, typeof visits>();
    for (const visit of visits) {
      const arr = byClient.get(visit.clientId) || [];
      arr.push(visit);
      byClient.set(visit.clientId, arr);
    }

    const createdInvoices = [];
    for (const [clientId, clientVisits] of byClient.entries()) {
      const lineItems: any[] = [];
      let subtotal = 0;
      let selectedRateCardId: string | null = null;

      for (const visit of clientVisits) {
        const rateCard = await resolveRateCard({
          organizationId,
          clientId,
          at: visit.scheduledStart ?? visit.clockInTime!,
          explicitRateCardId: payload.rateCardId,
          contractRef: payload.contractRef,
        });
        if (!rateCard) continue;

        selectedRateCardId = selectedRateCardId ?? rateCard.id;
        const hours = Math.max(0, (visit.clockOutTime!.getTime() - visit.clockInTime!.getTime()) / 3600000);
        const quantity = rateCard.billingRateType === BillingRateType.HOURLY ? hours : 1;
        const baseUnit =
          rateCard.billingRateType === BillingRateType.HOURLY
            ? rateCard.billingHourlyRate ?? 0
            : rateCard.billingFixedRate ?? 0;
        const at = visit.scheduledStart ?? visit.clockInTime!;
        const unitAmount = adjustedUnitAmount(rateCard.billingRateType, baseUnit, at, rateCard.billingModifiers);
        const lineTotal = Number((quantity * unitAmount).toFixed(2));
        subtotal += lineTotal;
        lineItems.push({
          visitId: visit.id,
          clientId: visit.clientId,
          clientName: visit.client.name,
          carerId: visit.carerId,
          carerName: visit.carer.name,
          scheduledStart: visit.scheduledStart?.toISOString() ?? null,
          clockInTime: visit.clockInTime!.toISOString(),
          clockOutTime: visit.clockOutTime!.toISOString(),
          billingRateType: rateCard.billingRateType,
          quantity: Number(quantity.toFixed(2)),
          unitAmount: Number(unitAmount.toFixed(2)),
          lineTotal,
          rateCardId: rateCard.id,
          billingModifiersApplied: Math.abs(unitAmount - baseUnit) > 0.005,
        });
      }

      if (lineItems.length === 0) continue;
      const dueAt = new Date();
      dueAt.setDate(dueAt.getDate() + payload.dueDays);
      const invoice = await prisma.invoice.create({
        data: {
          organizationId,
          clientId,
          rateCardId: selectedRateCardId,
          periodStart,
          periodEnd,
          dueAt,
          currency: payload.currency.toUpperCase(),
          status: InvoiceStatus.DRAFT,
          subtotal: Number(subtotal.toFixed(2)),
          total: Number(subtotal.toFixed(2)),
          lineItems,
          xeroReference: `HAVENCHECK-${clientId.slice(0, 6)}-${periodStart.toISOString().slice(0, 10)}`,
        },
      });
      createdInvoices.push(invoice);
    }

    res.status(201).json({ created: createdInvoices.length, invoices: createdInvoices });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

const updateInvoiceSchema = z.object({
  status: z.nativeEnum(InvoiceStatus),
});

router.get('/invoices/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId },
      include: {
        client: { select: { id: true, name: true } },
        rateCard: { select: { id: true, name: true, billingRateType: true, billingModifiers: true } },
      },
    });
    if (!invoice) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/invoices/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const payload = updateInvoiceSchema.parse(req.body ?? {});
    const existing = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
    }
    if (!canTransitionInvoiceStatus(existing.status, payload.status)) {
      return res.status(400).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot change invoice status from ${existing.status} to ${payload.status}`,
      });
    }
    const invoice = await prisma.invoice.update({
      where: { id: existing.id },
      data: { status: payload.status },
      include: {
        client: { select: { id: true, name: true } },
        rateCard: { select: { id: true, name: true, billingRateType: true } },
      },
    });
    res.json(invoice);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

async function exportInvoiceCsv(req: AuthRequest, res: express.Response) {
  try {
    const organizationId = await requireOrgId(req, res);
    if (!organizationId) return;
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, organizationId },
      include: { client: { select: { id: true, name: true } } },
    });
    if (!invoice) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Invoice not found' });
    }

    const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems : [];
    const header = [
      'ContactName',
      'EmailAddress',
      'InvoiceNumber',
      'Reference',
      'InvoiceDate',
      'DueDate',
      'Description',
      'Quantity',
      'UnitAmount',
      'AccountCode',
      'TaxType',
      'Currency',
    ].join(',');
    const lines = lineItems.map((item: any, idx) =>
      [
        invoice.client.name,
        '',
        invoice.id,
        invoice.xeroReference ?? '',
        invoice.issuedAt.toISOString().slice(0, 10),
        invoice.dueAt.toISOString().slice(0, 10),
        item?.billingRateType === BillingRateType.FIXED
          ? `Fixed visit fee - ${item?.carerName ?? 'Carer'}`
          : `Hourly care (${item?.quantity ?? 0}h) - ${item?.carerName ?? 'Carer'}`,
        item?.quantity ?? 1,
        item?.unitAmount ?? 0,
        '200',
        'NONE',
        invoice.currency,
      ]
        .map((value) => escapeCsvField(value ?? (idx + 1).toString()))
        .join(',')
    );
    const csv = [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.id}-xero.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
}

router.get('/invoices/:id/export/xero', exportInvoiceCsv);

router.get('/invoices/:id/export/csv', async (req: AuthRequest, res) => {
  return exportInvoiceCsv(req, res);
});

export default router;
