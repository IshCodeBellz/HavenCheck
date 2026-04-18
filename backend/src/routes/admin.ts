import express from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { MedicationEventStatus, UserRole } from '@prisma/client';
import { z } from 'zod';
import { usersService } from '../services/users';
import { clientsService } from '../services/clients';
import { schedulesService } from '../services/schedules';
import { visitsService } from '../services/visits';
import { getUserOrganizationId } from '../lib/organization';
import { shiftPostingsService } from '../services/shiftPostings';
import { prisma } from '../lib/prisma';
import { sendEmailVerificationForUser } from '../lib/emailVerification';
import { buildMedicationEventWhere, escapeCsvField } from '../lib/marReports';
import { attachStockFields } from '../lib/medicationStockSerialize';
import { reportingService } from '../services/reportingService';
import { auditLogService } from '../services/auditLogService';
import { registerOrgReportingRoutes } from './orgReporting';

const router = express.Router();
const joinRequestReviewSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  note: z.string().trim().max(250).optional(),
});
const teamSchema = z.object({
  name: z.string().trim().min(2),
  managerId: z.string().trim().min(1),
  memberIds: z.array(z.string().trim().min(1)).optional().default([]),
});
const medicationSchema = z.object({
  name: z.string().trim().min(1),
  dosage: z.string().trim().optional(),
  instructions: z.string().trim().optional(),
  isPrn: z.boolean().optional(),
  currentStock: z.number().int().nonnegative().optional(),
  reorderThreshold: z.number().int().nonnegative().optional(),
});
const medicationScheduleSchema = z.object({
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'timeOfDay must be in HH:mm format'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([]),
  isPrn: z.boolean().optional(),
  active: z.boolean().optional(),
});

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('ADMIN'));

async function requireAdminOrg(req: AuthRequest, res: express.Response): Promise<string | null> {
  const organizationId = await getUserOrganizationId(req.userId!);
  if (!organizationId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    return null;
  }
  return organizationId;
}

async function validateTeamUsers(organizationId: string, managerId: string, memberIds: string[]) {
  const users = await prisma.user.findMany({
    where: { id: { in: [managerId, ...memberIds] }, organizationId, isActive: true },
    select: { id: true, role: true },
  });
  if (users.length !== new Set([managerId, ...memberIds]).size) {
    const error: any = new Error('All selected users must exist and belong to your organization');
    error.status = 400;
    throw error;
  }
  const manager = users.find((u) => u.id === managerId);
  if (!manager || manager.role !== 'MANAGER') {
    const error: any = new Error('Selected manager must have MANAGER role');
    error.status = 400;
    throw error;
  }
  const invalidMembers = users.filter((u) => memberIds.includes(u.id) && u.role !== 'CARER');
  if (invalidMembers.length > 0) {
    const error: any = new Error('Only CARER users can be added as team members');
    error.status = 400;
    throw error;
  }
}

// Users management
router.get('/users', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const users = await usersService.getUsers(organizationId);
    res.json(users);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/users/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const user = await usersService.getUserById(req.params.id, organizationId);
    res.json(user);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/users', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const user = await usersService.createUser(req.body, organizationId);
    res.status(201).json(user);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/users/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const user = await usersService.updateUser(req.params.id, req.body, organizationId);
    res.json(user);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/join-requests', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const status = (req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined) ?? 'PENDING';
    const requests = await prisma.organizationJoinRequest.findMany({
      where: { organizationId, status },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        requesterName: true,
        requesterEmail: true,
        requestedRole: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        reviewNote: true,
      },
    });
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/join-requests/:id/approve', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const { role, note } = joinRequestReviewSchema.parse(req.body ?? {});
    const joinRequest = await prisma.organizationJoinRequest.findFirst({
      where: { id: req.params.id, organizationId, status: 'PENDING' },
    });
    if (!joinRequest) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Join request not found' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: joinRequest.requesterEmail },
      select: { id: true },
    });
    if (existingUser) {
      return res.status(409).json({ error: 'EMAIL_IN_USE', message: 'User with this email already exists' });
    }

    const approvedRole = role ?? joinRequest.requestedRole;
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: joinRequest.requesterName,
          email: joinRequest.requesterEmail,
          passwordHash: joinRequest.passwordHash,
          role: approvedRole,
          organizationId,
        },
        select: { id: true, name: true, email: true, role: true, isActive: true },
      });
      await tx.organizationJoinRequest.update({
        where: { id: joinRequest.id },
        data: { status: 'APPROVED', reviewedById: req.userId, reviewedAt: new Date(), reviewNote: note },
      });
      return user;
    });

    try {
      await sendEmailVerificationForUser(result.id);
    } catch (err) {
      console.error('Verification email after join approval:', err);
    }

    res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/join-requests/:id/reject', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const { note } = joinRequestReviewSchema.parse(req.body ?? {});
    const updated = await prisma.organizationJoinRequest.updateMany({
      where: { id: req.params.id, organizationId, status: 'PENDING' },
      data: { status: 'REJECTED', reviewedById: req.userId, reviewedAt: new Date(), reviewNote: note },
    });
    if (updated.count === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Join request not found' });
    }
    res.json({ ok: true });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/teams', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const teams = await prisma.team.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      },
    });
    res.json(teams);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/teams', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const { name, managerId, memberIds } = teamSchema.parse(req.body);
    await validateTeamUsers(organizationId, managerId, memberIds);
    const created = await prisma.team.create({
      data: {
        organizationId,
        name,
        managerId,
        members: {
          create: memberIds.map((id) => ({ userId: id })),
        },
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      },
    });
    res.status(201).json(created);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/teams/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const { name, managerId, memberIds } = teamSchema.partial().parse(req.body ?? {});
    const existing = await prisma.team.findFirst({
      where: { id: req.params.id, organizationId },
      include: { members: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Team not found' });
    }
    const nextManagerId = managerId ?? existing.managerId;
    const nextMemberIds = memberIds ?? existing.members.map((m) => m.userId);
    await validateTeamUsers(organizationId, nextManagerId, nextMemberIds);
    const updated = await prisma.$transaction(async (tx) => {
      const team = await tx.team.update({
        where: { id: existing.id },
        data: {
          name,
          managerId: nextManagerId,
        },
      });
      await tx.teamMembership.deleteMany({ where: { teamId: existing.id } });
      if (nextMemberIds.length > 0) {
        await tx.teamMembership.createMany({
          data: nextMemberIds.map((userId) => ({ teamId: existing.id, userId })),
        });
      }
      return team;
    });
    const hydrated = await prisma.team.findUnique({
      where: { id: updated.id },
      include: {
        manager: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
      },
    });
    res.json(hydrated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Carers (CARER role only) — spec-style paths over users table
router.get('/carers', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const users = await usersService.getUsers(organizationId);
    res.json(users.filter((u) => u.role === UserRole.CARER));
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/carers/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const user = await usersService.getUserById(req.params.id, organizationId);
    if (user.role !== UserRole.CARER) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Carer not found' });
    }
    res.json(user);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/carers', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const user = await usersService.createUser({ ...req.body, role: UserRole.CARER }, organizationId);
    res.status(201).json(user);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/carers/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const existing = await usersService.getUserById(req.params.id, organizationId);
    if (existing.role !== UserRole.CARER) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Carer not found' });
    }
    const user = await usersService.updateUser(req.params.id, req.body, organizationId);
    res.json(user);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Clients - full CRUD
router.get('/clients', async (req: AuthRequest, res) => {
  try {
    const clients = await clientsService.getClients();
    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/clients/:clientId/visits', async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query;
    const visits = await visitsService.getVisits(undefined, {
      clientId: req.params.clientId,
      startDate: from,
      endDate: to,
    });
    res.json(visits);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/clients/:id', async (req: AuthRequest, res) => {
  try {
    const client = await clientsService.getClientById(req.params.id);
    res.json(client);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/clients', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const client = await clientsService.createClient({ ...req.body, organizationId });
    res.status(201).json(client);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/clients/:id', async (req: AuthRequest, res) => {
  try {
    const client = await clientsService.updateClient(req.params.id, req.body);
    res.json(client);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.delete('/clients/:id', async (req: AuthRequest, res) => {
  try {
    await clientsService.deleteClient(req.params.id);
    res.json({ message: 'Client deleted' });
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Schedules - full CRUD
router.get('/schedules', async (req: AuthRequest, res) => {
  try {
    const schedules = await schedulesService.getSchedules(undefined, req.query);
    res.json(schedules);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/schedules/:id', async (req: AuthRequest, res) => {
  try {
    const schedule = await schedulesService.getScheduleById(req.params.id);
    res.json(schedule);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/schedules', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }
    const schedule = await schedulesService.createSchedule(req.body, { organizationId });
    res.status(201).json(schedule);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message, code: error.code });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/schedules/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }
    const schedule = await schedulesService.updateSchedule(req.params.id, req.body, { organizationId });
    res.json(schedule);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message, code: error.code });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.delete('/schedules/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }
    await schedulesService.deleteSchedule(req.params.id, { organizationId });
    res.json({ message: 'Schedule deleted' });
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/shift-postings', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const items = await shiftPostingsService.listForStaff(organizationId, req.query as any);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/shift-postings', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const created = await shiftPostingsService.createPosting(organizationId, req.userId, req.body);
    res.status(201).json(created);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message, code: error.code });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/shift-postings/:id', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const item = await shiftPostingsService.getByIdForStaff(req.params.id, organizationId);
    res.json(item);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/shift-postings/:id/select', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const { applicationIds } = req.body || {};
    const item = await shiftPostingsService.selectApplicants(organizationId, req.params.id, applicationIds);
    res.json(item);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message, code: error.code });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/shift-postings/:id/cancel', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const item = await shiftPostingsService.cancelPosting(req.params.id, organizationId);
    res.json(item);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Visits - full access
router.get('/visits', async (req: AuthRequest, res) => {
  try {
    const visits = await visitsService.getVisits(undefined, req.query);
    res.json(visits);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/visits/:id', async (req: AuthRequest, res) => {
  try {
    const visit = await visitsService.getVisitById(req.params.id);
    res.json(visit);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/reports/timesheets', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const { from, to, carerId, clientId } = req.query;
    const data = await visitsService.getTimesheetReport({
      organizationId,
      from: from as string | undefined,
      to: to as string | undefined,
      carerId: carerId as string | undefined,
      clientId: clientId as string | undefined,
    });
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

const marEventInclude = {
  client: { select: { id: true, name: true } },
  visit: {
    select: {
      id: true,
      scheduledStart: true,
      scheduledEnd: true,
      carer: { select: { id: true, name: true } },
    },
  },
  medication: {
    select: {
      id: true,
      name: true,
      dosage: true,
      isPrn: true,
      stock: { select: { currentStock: true, reorderThreshold: true } },
    },
  },
  recordedBy: { select: { id: true, name: true } },
} as const;

router.get('/reports/mar-chart', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;

    const { clientId, from, to, status } = req.query;
    const where = buildMedicationEventWhere(organizationId, {
      clientId: clientId as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      status: status as string | undefined,
    });

    const events = await prisma.medicationEvent.findMany({
      where,
      include: marEventInclude,
      orderBy: { administeredAt: 'desc' },
      take: 500,
    });

    res.json(events.map((e) => ({ ...e, medication: attachStockFields(e.medication) })));
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/reports/mar-chart/export', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;

    const { clientId, from, to, status } = req.query;
    const where = buildMedicationEventWhere(organizationId, {
      clientId: clientId as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      status: status as string | undefined,
    });

    const events = await prisma.medicationEvent.findMany({
      where,
      include: marEventInclude,
      orderBy: { administeredAt: 'desc' },
      take: 10000,
    });

    const flatEvents = events.map((e) => ({ ...e, medication: attachStockFields(e.medication) }));

    const header = [
      'administeredAt',
      'clientName',
      'medicationName',
      'dosage',
      'isPrn',
      'status',
      'visitId',
      'scheduledStart',
      'scheduledEnd',
      'carerName',
      'recordedByName',
      'reasonCode',
      'prnIndication',
      'note',
      'effectivenessNote',
      'dosageGiven',
      'signatureImage',
      'signedAt',
      'signedByUserId',
    ].join(',');

    const lines = flatEvents.map((e) =>
      [
        e.administeredAt.toISOString(),
        e.client.name,
        e.medication.name,
        e.medication.dosage ?? '',
        e.medication.isPrn ? 'true' : 'false',
        e.status,
        e.visitId,
        e.visit.scheduledStart?.toISOString() ?? '',
        e.visit.scheduledEnd?.toISOString() ?? '',
        e.visit.carer?.name ?? '',
        e.recordedBy.name,
        e.reasonCode ?? '',
        e.prnIndication ?? '',
        e.note ?? '',
        e.effectivenessNote ?? '',
        e.dosageGiven ?? '',
        e.signatureImage ?? '',
        e.signedAt?.toISOString() ?? '',
        e.signedByUserId ?? '',
      ]
        .map((v) => escapeCsvField(v))
        .join(',')
    );

    const csv = [header, ...lines].join('\r\n');
    const filename = `mar-export-${organizationId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/reports/medication-compliance', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;

    const { clientId, from, to } = req.query;
    const where = buildMedicationEventWhere(organizationId, {
      clientId: clientId as string | undefined,
      from: from as string | undefined,
      to: to as string | undefined,
    });

    const byStatus = await prisma.medicationEvent.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    let administered = 0;
    let omitted = 0;
    for (const row of byStatus) {
      if (row.status === MedicationEventStatus.ADMINISTERED) administered = row._count._all;
      if (row.status === MedicationEventStatus.OMITTED) omitted = row._count._all;
    }
    const total = administered + omitted;
    const administeredRate = total > 0 ? administered / total : 0;
    const omittedRate = total > 0 ? omitted / total : 0;

    const reasonGroups = await prisma.medicationEvent.groupBy({
      by: ['reasonCode'],
      where: {
        ...where,
        status: MedicationEventStatus.OMITTED,
        reasonCode: { not: null },
      },
      _count: { _all: true },
    });

    const topOmissionReasons = reasonGroups
      .filter((r) => r.reasonCode)
      .map((r) => ({ reason: r.reasonCode as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      totalEvents: total,
      administered,
      omitted,
      administeredRate,
      omittedRate,
      topOmissionReasons,
      filters: {
        from: (from as string) || null,
        to: (to as string) || null,
        clientId: (clientId as string) || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/reports/enterprise', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const data = await reportingService.getEnterpriseReports(
      organizationId,
      req.query.from as string | undefined,
      req.query.to as string | undefined
    );
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/audit-logs', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const logs = await prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/clients/:clientId/medications', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;

    const client = await prisma.client.findFirst({
      where: { id: req.params.clientId, organizationId },
      select: { id: true },
    });
    if (!client) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });
    }

    const medications = await prisma.medication.findMany({
      where: { clientId: client.id, organizationId },
      include: {
        stock: true,
        schedules: {
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(medications.map((m) => attachStockFields(m)));
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/clients/:clientId/medications', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const payload = medicationSchema.parse(req.body);

    const client = await prisma.client.findFirst({
      where: { id: req.params.clientId, organizationId },
      select: { id: true },
    });
    if (!client) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });
    }

    const medication = await prisma.medication.create({
      data: {
        organizationId,
        clientId: client.id,
        name: payload.name,
        dosage: payload.dosage || null,
        instructions: payload.instructions || null,
        isPrn: payload.isPrn ?? false,
        ...(payload.currentStock !== undefined || payload.reorderThreshold !== undefined
          ? {
              stock: {
                create: {
                  currentStock: payload.currentStock ?? null,
                  reorderThreshold: payload.reorderThreshold ?? null,
                },
              },
            }
          : {}),
      },
      include: { stock: true },
    });

    await prisma.medicationAuditLog.create({
      data: {
        organizationId,
        medicationId: medication.id,
        action: 'MEDICATION_CREATED',
        actorId: req.userId!,
        payload: {
          clientId: client.id,
          name: medication.name,
        },
      },
    });

    res.status(201).json(attachStockFields(medication));
    await auditLogService.log({
      organizationId,
      module: 'medication',
      action: 'CREATE',
      entityType: 'Medication',
      entityId: medication.id,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      afterData: medication,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/medications/:medicationId/schedules', async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireAdminOrg(req, res);
    if (!organizationId) return;
    const payload = medicationScheduleSchema.parse(req.body);

    const medication = await prisma.medication.findFirst({
      where: { id: req.params.medicationId, organizationId },
      select: { id: true, clientId: true },
    });
    if (!medication) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Medication not found' });
    }

    const schedule = await prisma.medicationSchedule.create({
      data: {
        organizationId,
        medicationId: medication.id,
        timeOfDay: payload.timeOfDay,
        daysOfWeek: payload.daysOfWeek.map(String),
        isPrn: payload.isPrn ?? false,
        active: payload.active ?? true,
      },
    });

    await prisma.medicationAuditLog.create({
      data: {
        organizationId,
        medicationId: medication.id,
        action: 'MEDICATION_SCHEDULE_CREATED',
        actorId: req.userId!,
        payload: {
          scheduleId: schedule.id,
          timeOfDay: schedule.timeOfDay,
          daysOfWeek: schedule.daysOfWeek,
        },
      },
    });

    res.status(201).json(schedule);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

registerOrgReportingRoutes(router, requireAdminOrg);

export default router;
