import express from 'express';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getUserOrganizationId } from '../lib/organization';

const router = express.Router();
router.use(authenticate);

const inviteGuardianSchema = z.object({
  guardianUserId: z.string().min(1),
  clientId: z.string().min(1),
  readOnly: z.boolean().optional(),
  canViewVisits: z.boolean().optional(),
  canViewNotes: z.boolean().optional(),
  canViewIncidents: z.boolean().optional(),
});

const registerDeviceSchema = z.object({
  expoPushToken: z.string().min(10).max(512),
});

async function requireOrg(req: AuthRequest, res: express.Response) {
  const organizationId = await getUserOrganizationId(req.userId!);
  if (!organizationId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    return null;
  }
  return organizationId;
}

function visitDurationMinutes(clockIn: Date | null, clockOut: Date | null): number | null {
  if (!clockIn || !clockOut) return null;
  const m = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
  return m > 0 ? m : null;
}

function noteHeadline(noteType: string, text: string): string {
  const t = text.trim();
  const first = t.split('\n')[0]?.slice(0, 80) || '';
  if (noteType === 'HANDOVER') return first ? `Handover: ${first}` : 'Handover note';
  if (noteType === 'INCIDENT') return first ? `Visit note: ${first}` : 'Visit note (incident-related)';
  return first ? `Note: ${first}` : 'Care note';
}

router.post('/invite', async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== UserRole.ADMIN && req.userRole !== UserRole.MANAGER) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only staff can invite guardians' });
    }
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const payload = inviteGuardianSchema.parse(req.body);

    const guardian = await prisma.user.findFirst({
      where: { id: payload.guardianUserId, organizationId, role: UserRole.GUARDIAN },
      select: { id: true },
    });
    if (!guardian) return res.status(404).json({ error: 'NOT_FOUND', message: 'Guardian not found' });

    const client = await prisma.client.findFirst({
      where: { id: payload.clientId, organizationId },
      select: { id: true },
    });
    if (!client) return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });

    const link = await prisma.guardianLink.upsert({
      where: { guardianUserId_clientId: { guardianUserId: payload.guardianUserId, clientId: payload.clientId } },
      update: {
        readOnly: payload.readOnly ?? true,
        canViewVisits: payload.canViewVisits ?? true,
        canViewNotes: payload.canViewNotes ?? true,
        canViewIncidents: payload.canViewIncidents ?? true,
        active: true,
      },
      create: {
        organizationId,
        guardianUserId: payload.guardianUserId,
        clientId: payload.clientId,
        readOnly: payload.readOnly ?? true,
        canViewVisits: payload.canViewVisits ?? true,
        canViewNotes: payload.canViewNotes ?? true,
        canViewIncidents: payload.canViewIncidents ?? true,
      },
    });
    res.status(201).json(link);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

/** Register Expo push token for care alerts (mobile family app). */
router.post('/device', async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== UserRole.GUARDIAN) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only guardians can register a device token' });
    }
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const body = registerDeviceSchema.parse(req.body);
    await prisma.user.update({
      where: { id: req.userId! },
      data: { expoPushToken: body.expoPushToken },
    });
    res.json({ ok: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/feed', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    if (req.userRole !== UserRole.GUARDIAN) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only guardians can access this feed endpoint' });
    }
    const clientIdFilter = req.query.clientId ? String(req.query.clientId) : undefined;
    const sinceRaw = req.query.since ? String(req.query.since) : undefined;
    const sinceMs = sinceRaw ? Date.parse(sinceRaw) : NaN;
    const sinceDate = Number.isFinite(sinceMs) ? new Date(sinceMs) : null;

    const links = await prisma.guardianLink.findMany({
      where: {
        organizationId,
        guardianUserId: req.userId!,
        active: true,
        ...(clientIdFilter ? { clientId: clientIdFilter } : {}),
      },
      select: { clientId: true, canViewVisits: true, canViewNotes: true, canViewIncidents: true },
    });
    if (links.length === 0) return res.json([]);
    const clientIds = links.map((l) => l.clientId);
    const byClient = new Map(links.map((l) => [l.clientId, l]));

    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds }, organizationId },
      select: { id: true, name: true },
    });
    const clientNameById = new Map(clients.map((c) => [c.id, c.name]));

    type Out = {
      id: string;
      type: 'visit' | 'note' | 'incident';
      createdAt: string;
      client: { id: string; name: string };
      headline: string;
      subheadline?: string;
      visit?: {
        id: string;
        status: string;
        scheduledStart: string | null;
        scheduledEnd: string | null;
        clockInTime: string | null;
        clockOutTime: string | null;
        durationMinutes: number | null;
        carerName: string | null;
      };
      note?: { id: string; text: string; type: string; priority: string };
      incident?: {
        id: string;
        category: string;
        severity: string;
        status: string;
        safeguardingFlag: boolean;
        details: string | null;
        reportedAt: string;
      };
    };

    const items: Out[] = [];

    const visits = await prisma.visit.findMany({
      where: { clientId: { in: clientIds }, status: 'COMPLETED' },
      select: {
        id: true,
        clientId: true,
        scheduledStart: true,
        scheduledEnd: true,
        clockInTime: true,
        clockOutTime: true,
        status: true,
        updatedAt: true,
        carer: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    for (const v of visits) {
      if (!byClient.get(v.clientId)?.canViewVisits) continue;
      const createdAt = v.clockOutTime ?? v.updatedAt;
      if (sinceDate && createdAt.getTime() <= sinceDate.getTime()) continue;
      const durationMinutes = visitDurationMinutes(v.clockInTime, v.clockOutTime);
      const clientName = clientNameById.get(v.clientId) || 'Client';
      const carerName = v.carer.name;
      items.push({
        id: v.id,
        type: 'visit',
        createdAt: createdAt.toISOString(),
        client: { id: v.clientId, name: clientName },
        headline: 'Visit completed',
        subheadline: carerName
          ? `${carerName}${durationMinutes != null ? ` · ${durationMinutes} min` : ''}`
          : durationMinutes != null
            ? `${durationMinutes} min`
            : undefined,
        visit: {
          id: v.id,
          status: v.status,
          scheduledStart: v.scheduledStart?.toISOString() ?? null,
          scheduledEnd: v.scheduledEnd?.toISOString() ?? null,
          clockInTime: v.clockInTime?.toISOString() ?? null,
          clockOutTime: v.clockOutTime?.toISOString() ?? null,
          durationMinutes,
          carerName,
        },
      });
    }

    const notes = await prisma.note.findMany({
      where: { visit: { clientId: { in: clientIds } } },
      select: {
        id: true,
        text: true,
        type: true,
        priority: true,
        createdAt: true,
        visit: { select: { clientId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    for (const n of notes) {
      const cid = n.visit.clientId;
      if (!byClient.get(cid)?.canViewNotes) continue;
      if (sinceDate && n.createdAt.getTime() <= sinceDate.getTime()) continue;
      const clientName = clientNameById.get(cid) || 'Client';
      const headline = noteHeadline(n.type, n.text);
      items.push({
        id: n.id,
        type: 'note',
        createdAt: n.createdAt.toISOString(),
        client: { id: cid, name: clientName },
        headline,
        subheadline: n.priority === 'HIGH' ? 'High priority' : undefined,
        note: {
          id: n.id,
          text: n.text,
          type: n.type,
          priority: n.priority,
        },
      });
    }

    const incidents = await prisma.incident.findMany({
      where: { organizationId, clientId: { in: clientIds } },
      select: {
        id: true,
        clientId: true,
        category: true,
        severity: true,
        safeguardingFlag: true,
        status: true,
        details: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    for (const i of incidents) {
      if (!byClient.get(i.clientId)?.canViewIncidents) continue;
      const createdAt = i.updatedAt;
      if (sinceDate && createdAt.getTime() <= sinceDate.getTime()) continue;
      const clientName = clientNameById.get(i.clientId) || 'Client';
      items.push({
        id: i.id,
        type: 'incident',
        createdAt: createdAt.toISOString(),
        client: { id: i.clientId, name: clientName },
        headline: i.category,
        subheadline: `${i.severity} · ${i.status}`,
        incident: {
          id: i.id,
          category: i.category,
          severity: i.severity,
          status: i.status,
          safeguardingFlag: i.safeguardingFlag,
          details: i.details,
          reportedAt: i.createdAt.toISOString(),
        },
      });
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(items.slice(0, 200));
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

export default router;
