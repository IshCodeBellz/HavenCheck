import express from 'express';
import { z } from 'zod';
import { IncidentActionStatus, IncidentSeverity, IncidentStatus, UserRole } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getUserOrganizationId } from '../lib/organization';
import { auditLogService } from '../services/auditLogService';
import { notificationService } from '../services/notificationService';

const router = express.Router();

const createIncidentSchema = z.object({
  clientId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  category: z.string().min(1),
  severity: z.nativeEnum(IncidentSeverity),
  safeguardingFlag: z.boolean().optional(),
  details: z.string().trim().optional(),
});

const escalateSchema = z.object({
  reason: z.string().trim().min(1),
  slaDueAt: z.string().datetime().optional(),
});

const followUpSchema = z.object({
  note: z.string().trim().min(1),
  dueAt: z.string().datetime().optional(),
  done: z.boolean().optional(),
});

const actionSchema = z.object({
  description: z.string().trim().min(1),
  ownerUserId: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  status: z.nativeEnum(IncidentActionStatus).optional(),
});

const bodyMapSchema = z.object({
  clientId: z.string().min(1),
  incidentId: z.string().optional(),
  coordinates: z.array(z.object({ x: z.number(), y: z.number(), zone: z.string().optional() })),
  notes: z.string().trim().optional(),
  images: z.array(z.string()).optional(),
});

router.use(authenticate);

async function requireOrg(req: AuthRequest, res: express.Response) {
  const organizationId = await getUserOrganizationId(req.userId!);
  if (!organizationId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    return null;
  }
  return organizationId;
}

router.post('/', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    if (req.userRole === UserRole.GUARDIAN) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Guardians cannot create incidents' });
    }
    const payload = createIncidentSchema.parse(req.body);
    const client = await prisma.client.findFirst({ where: { id: payload.clientId, organizationId }, select: { id: true } });
    if (!client) return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });

    const incident = await prisma.incident.create({
      data: {
        organizationId,
        clientId: payload.clientId,
        visitId: payload.visitId || null,
        reportedById: req.userId!,
        category: payload.category,
        severity: payload.severity,
        safeguardingFlag: payload.safeguardingFlag ?? false,
        details: payload.details || null,
      },
      include: {
        escalations: true,
        followUps: true,
        actions: true,
        client: { select: { name: true } },
        reportedBy: { select: { id: true, name: true } },
      },
    });

    await prisma.guardianFeedEvent.create({
      data: {
        organizationId,
        clientId: payload.clientId,
        sourceType: 'incident',
        sourceId: incident.id,
        createdById: req.userId!,
        payload: {
          category: incident.category,
          severity: incident.severity,
          safeguardingFlag: incident.safeguardingFlag,
          status: incident.status,
          details: incident.details,
        },
      },
    });

    void notificationService
      .notifyGuardiansIncidentReported({
        organizationId,
        incident: {
          id: incident.id,
          clientId: incident.clientId,
          clientName: incident.client.name,
          category: incident.category,
          severity: incident.severity,
          reportedById: incident.reportedById,
          reporterName: incident.reportedBy.name,
          details: incident.details,
        },
      })
      .catch((e) => console.error('guardian_incident_notify_failed', e));

    await auditLogService.log({
      organizationId,
      module: 'incidents',
      action: 'INCIDENT_CREATED',
      entityType: 'Incident',
      entityId: incident.id,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      afterData: {
        clientId: incident.clientId,
        category: incident.category,
        severity: incident.severity,
        status: incident.status,
        safeguardingFlag: incident.safeguardingFlag,
      },
    });

    res.status(201).json(incident);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const where: any = { organizationId };
    if (req.query.clientId) where.clientId = String(req.query.clientId);
    if (req.query.status) where.status = req.query.status as IncidentStatus;
    const incidents = await prisma.incident.findMany({
      where,
      include: { escalations: true, followUps: true, actions: true, client: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(incidents);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/:incidentId/escalate', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    if (req.userRole !== UserRole.ADMIN && req.userRole !== UserRole.MANAGER) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only managers/admins can escalate incidents' });
    }
    const payload = escalateSchema.parse(req.body);
    const incident = await prisma.incident.findFirst({ where: { id: req.params.incidentId, organizationId } });
    if (!incident) return res.status(404).json({ error: 'NOT_FOUND', message: 'Incident not found' });
    const result = await prisma.$transaction(async (tx) => {
      const escalation = await tx.incidentEscalation.create({
        data: {
          incidentId: incident.id,
          reason: payload.reason,
          escalatedById: req.userId!,
          slaDueAt: payload.slaDueAt ? new Date(payload.slaDueAt) : null,
        },
      });
      const updated = await tx.incident.update({
        where: { id: incident.id },
        data: { status: IncidentStatus.ESCALATED },
      });
      return { escalation, incident: updated };
    });
    await auditLogService.log({
      organizationId,
      module: 'incidents',
      action: 'INCIDENT_ESCALATED',
      entityType: 'Incident',
      entityId: result.incident.id,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      afterData: { escalationId: result.escalation.id, status: result.incident.status },
    });
    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/:incidentId/follow-ups', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const payload = followUpSchema.parse(req.body);
    const incident = await prisma.incident.findFirst({ where: { id: req.params.incidentId, organizationId }, select: { id: true } });
    if (!incident) return res.status(404).json({ error: 'NOT_FOUND', message: 'Incident not found' });
    const followUp = await prisma.incidentFollowUp.create({
      data: { incidentId: incident.id, note: payload.note, dueAt: payload.dueAt ? new Date(payload.dueAt) : null, done: payload.done ?? false },
    });
    await auditLogService.log({
      organizationId,
      module: 'incidents',
      action: 'INCIDENT_FOLLOW_UP_ADDED',
      entityType: 'Incident',
      entityId: incident.id,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      metadata: { followUpId: followUp.id },
    });
    res.status(201).json(followUp);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/:incidentId/actions', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const payload = actionSchema.parse(req.body);
    const incident = await prisma.incident.findFirst({ where: { id: req.params.incidentId, organizationId }, select: { id: true } });
    if (!incident) return res.status(404).json({ error: 'NOT_FOUND', message: 'Incident not found' });
    const action = await prisma.incidentAction.create({
      data: {
        incidentId: incident.id,
        description: payload.description,
        ownerUserId: payload.ownerUserId || null,
        createdById: req.userId!,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        status: payload.status ?? IncidentActionStatus.OPEN,
      },
    });
    await auditLogService.log({
      organizationId,
      module: 'incidents',
      action: 'INCIDENT_ACTION_CREATED',
      entityType: 'Incident',
      entityId: incident.id,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      metadata: { actionId: action.id, status: action.status },
    });
    res.status(201).json(action);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/body-maps', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    if (req.userRole === UserRole.GUARDIAN) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Guardians cannot add body maps' });
    }
    const payload = bodyMapSchema.parse(req.body);
    const client = await prisma.client.findFirst({ where: { id: payload.clientId, organizationId }, select: { id: true } });
    if (!client) return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });
    const entry = await prisma.bodyMapEntry.create({
      data: {
        organizationId,
        clientId: payload.clientId,
        incidentId: payload.incidentId || null,
        recordedById: req.userId!,
        coordinates: payload.coordinates,
        notes: payload.notes || null,
        images: payload.images || [],
      },
    });
    await auditLogService.log({
      organizationId,
      module: 'incidents',
      action: 'BODY_MAP_RECORDED',
      entityType: payload.incidentId ? 'Incident' : 'Client',
      entityId: payload.incidentId || payload.clientId,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      metadata: { bodyMapEntryId: entry.id, clientId: payload.clientId },
    });
    res.status(201).json(entry);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/clients/:clientId/body-maps', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const rows = await prisma.bodyMapEntry.findMany({
      where: { organizationId, clientId: req.params.clientId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

export default router;
