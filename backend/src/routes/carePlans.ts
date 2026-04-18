import express from 'express';
import { z } from 'zod';
import { CarePlanSectionType, CarePlanStatus, UserRole } from '@prisma/client';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { getUserOrganizationId } from '../lib/organization';
import { prisma } from '../lib/prisma';
import { auditLogService } from '../services/auditLogService';

const router = express.Router();

const sectionInputSchema = z.object({
  sectionType: z.nativeEnum(CarePlanSectionType),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  orderIndex: z.number().int().min(0).optional(),
});

const createCarePlanSchema = z.object({
  clientId: z.string().trim().min(1),
  status: z.nativeEnum(CarePlanStatus).optional(),
  reviewDate: z.string().datetime().optional(),
  reviewReminderAt: z.string().datetime().optional(),
  summary: z.string().trim().optional(),
  sections: z.array(sectionInputSchema).min(1),
});

const updateCarePlanSchema = z.object({
  status: z.nativeEnum(CarePlanStatus).optional(),
  reviewDate: z.string().datetime().nullable().optional(),
  reviewReminderAt: z.string().datetime().nullable().optional(),
});

const createVersionSchema = z.object({
  summary: z.string().trim().optional(),
  sections: z.array(sectionInputSchema).min(1),
});

const templateSectionSchema = z.object({
  sectionType: z.nativeEnum(CarePlanSectionType),
  title: z.string().trim().min(1),
  body: z.string().optional().default(''),
  orderIndex: z.number().int().min(0).optional(),
});

const createCarePlanTemplateSchema = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  sections: z.array(templateSectionSchema).min(1),
});

const defaultCarePlanTemplates = [
  {
    key: 'mobility',
    name: 'Mobility Support Template',
    description: 'Structured support plan for mobility, transfers, and movement safety.',
    sections: [
      { sectionType: 'NEEDS', title: 'Mobility needs', body: '' },
      { sectionType: 'STRENGTHS', title: 'Mobility strengths', body: '' },
      { sectionType: 'RISKS', title: 'Mobility risks', body: '' },
      { sectionType: 'ACTIONS', title: 'Mobility actions', body: '' },
    ],
  },
  {
    key: 'personal-care',
    name: 'Personal Care Template',
    description: 'Day-to-day personal care routine and support strategy.',
    sections: [
      { sectionType: 'NEEDS', title: 'Personal care needs', body: '' },
      { sectionType: 'STRENGTHS', title: 'Personal care strengths', body: '' },
      { sectionType: 'RISKS', title: 'Personal care risks', body: '' },
      { sectionType: 'ACTIONS', title: 'Personal care actions', body: '' },
    ],
  },
  {
    key: 'nutrition',
    name: 'Nutrition Template',
    description: 'Nutrition, hydration, and dietary support plan.',
    sections: [
      { sectionType: 'NEEDS', title: 'Nutrition needs', body: '' },
      { sectionType: 'STRENGTHS', title: 'Nutrition strengths', body: '' },
      { sectionType: 'RISKS', title: 'Nutrition risks', body: '' },
      { sectionType: 'ACTIONS', title: 'Nutrition actions', body: '' },
    ],
  },
] as const;

router.use(authenticate);

async function requireOrg(req: AuthRequest, res: express.Response) {
  const organizationId = await getUserOrganizationId(req.userId!);
  if (!organizationId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    return null;
  }
  return organizationId;
}

router.get('/templates', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;

    const existingCount = await prisma.carePlanTemplate.count({ where: { organizationId } });
    if (existingCount === 0) {
      await prisma.carePlanTemplate.createMany({
        data: defaultCarePlanTemplates.map((template) => ({
          organizationId,
          key: template.key,
          name: template.name,
          description: template.description,
          sections: template.sections,
        })),
      });
    }

    const templates = await prisma.carePlanTemplate.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/client/:clientId', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;

    const plans = await prisma.carePlan.findMany({
      where: { organizationId, clientId: req.params.clientId },
      include: {
        currentVersion: {
          include: {
            sections: { orderBy: [{ sectionType: 'asc' }, { orderIndex: 'asc' }] },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/reviews/overdue', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const now = new Date();
    const plans = await prisma.carePlan.findMany({
      where: {
        organizationId,
        status: CarePlanStatus.ACTIVE,
        reviewDate: { lt: now },
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { reviewDate: 'asc' },
    });
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/reviews/reminders', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const now = new Date();
    const plans = await prisma.carePlan.findMany({
      where: {
        organizationId,
        status: CarePlanStatus.ACTIVE,
        reviewReminderAt: { lte: now },
        OR: [{ reviewReminderSentAt: null }, { reviewReminderSentAt: { lt: now } }],
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { reviewReminderAt: 'asc' },
    });
    res.json(plans);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/templates', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const payload = createCarePlanTemplateSchema.parse(req.body);
    const existing = await prisma.carePlanTemplate.findFirst({
      where: { organizationId, key: payload.key },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({ error: 'CONFLICT', message: 'A template with this key already exists' });
    }
    const created = await prisma.carePlanTemplate.create({
      data: {
        organizationId,
        key: payload.key,
        name: payload.name,
        description: payload.description || null,
        sections: payload.sections.map((section, index) => ({
          sectionType: section.sectionType,
          title: section.title,
          body: section.body ?? '',
          orderIndex: section.orderIndex ?? index,
        })),
      },
    });
    res.status(201).json(created);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const payload = createCarePlanSchema.parse(req.body);

    const client = await prisma.client.findFirst({
      where: { id: payload.clientId, organizationId },
      select: { id: true },
    });
    if (!client) return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });

    const created = await prisma.$transaction(async (tx) => {
      const carePlan = await tx.carePlan.create({
        data: {
          organizationId,
          clientId: client.id,
          status: payload.status ?? CarePlanStatus.DRAFT,
          reviewDate: payload.reviewDate ? new Date(payload.reviewDate) : null,
          reviewReminderAt: payload.reviewReminderAt ? new Date(payload.reviewReminderAt) : null,
          createdById: req.userId!,
        },
      });
      const version = await tx.carePlanVersion.create({
        data: {
          carePlanId: carePlan.id,
          version: 1,
          summary: payload.summary || null,
          createdById: req.userId!,
          sections: {
            create: payload.sections.map((section, index) => ({
              sectionType: section.sectionType,
              title: section.title,
              body: section.body,
              orderIndex: section.orderIndex ?? index,
            })),
          },
        },
      });
      await tx.carePlan.update({
        where: { id: carePlan.id },
        data: { currentVersionId: version.id },
      });
      return tx.carePlan.findUnique({
        where: { id: carePlan.id },
        include: {
          currentVersion: { include: { sections: { orderBy: [{ sectionType: 'asc' }, { orderIndex: 'asc' }] } } },
        },
      });
    });

    if (created) {
      await auditLogService.log({
        organizationId,
        module: 'care_plans',
        action: 'CARE_PLAN_CREATED',
        entityType: 'CarePlan',
        entityId: created.id,
        actorId: req.userId!,
        actorRole: req.userRole,
        route: req.path,
        method: req.method,
        afterData: { clientId: created.clientId, status: created.status },
      });
    }

    res.status(201).json(created);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/:carePlanId', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const payload = updateCarePlanSchema.parse(req.body ?? {});
    const before = await prisma.carePlan.findFirst({
      where: { id: req.params.carePlanId, organizationId },
      select: { id: true, status: true, reviewDate: true, reviewReminderAt: true, clientId: true },
    });
    if (!before) return res.status(404).json({ error: 'NOT_FOUND', message: 'Care plan not found' });
    const updated = await prisma.carePlan.updateMany({
      where: { id: req.params.carePlanId, organizationId },
      data: {
        status: payload.status,
        reviewDate: payload.reviewDate === undefined ? undefined : payload.reviewDate ? new Date(payload.reviewDate) : null,
        reviewReminderAt:
          payload.reviewReminderAt === undefined
            ? undefined
            : payload.reviewReminderAt
              ? new Date(payload.reviewReminderAt)
              : null,
      },
    });
    if (updated.count === 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'Care plan not found' });
    const plan = await prisma.carePlan.findUnique({
      where: { id: req.params.carePlanId },
      include: { currentVersion: { include: { sections: true } } },
    });
    await auditLogService.log({
      organizationId,
      module: 'care_plans',
      action: 'CARE_PLAN_UPDATED',
      entityType: 'CarePlan',
      entityId: req.params.carePlanId,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      beforeData: before,
      afterData: {
        status: plan?.status,
        reviewDate: plan?.reviewDate,
        reviewReminderAt: plan?.reviewReminderAt,
      },
    });
    res.json(plan);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/:carePlanId/versions', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const payload = createVersionSchema.parse(req.body);

    const carePlan = await prisma.carePlan.findFirst({
      where: { id: req.params.carePlanId, organizationId },
      include: { versions: { select: { version: true }, orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!carePlan) return res.status(404).json({ error: 'NOT_FOUND', message: 'Care plan not found' });
    const nextVersion = (carePlan.versions[0]?.version ?? 0) + 1;

    const created = await prisma.$transaction(async (tx) => {
      const version = await tx.carePlanVersion.create({
        data: {
          carePlanId: carePlan.id,
          version: nextVersion,
          summary: payload.summary || null,
          createdById: req.userId!,
          sections: {
            create: payload.sections.map((section, index) => ({
              sectionType: section.sectionType,
              title: section.title,
              body: section.body,
              orderIndex: section.orderIndex ?? index,
            })),
          },
        },
        include: { sections: { orderBy: [{ sectionType: 'asc' }, { orderIndex: 'asc' }] } },
      });
      await tx.carePlan.update({
        where: { id: carePlan.id },
        data: { currentVersionId: version.id },
      });
      return version;
    });

    await auditLogService.log({
      organizationId,
      module: 'care_plans',
      action: 'CARE_PLAN_VERSION_CREATED',
      entityType: 'CarePlan',
      entityId: carePlan.id,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      metadata: { versionId: created.id, versionNumber: created.version },
    });

    res.status(201).json(created);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/:carePlanId/reminders/:action', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    if (req.params.action !== 'mark-sent') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Unsupported reminder action' });
    }
    const updated = await prisma.carePlan.updateMany({
      where: { id: req.params.carePlanId, organizationId },
      data: { reviewReminderSentAt: new Date() },
    });
    if (updated.count === 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'Care plan not found' });
    await auditLogService.log({
      organizationId,
      module: 'care_plans',
      action: 'CARE_PLAN_REVIEW_REMINDER_MARK_SENT',
      entityType: 'CarePlan',
      entityId: req.params.carePlanId,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
    });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

export default router;
