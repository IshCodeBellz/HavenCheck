import express from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { visitsService } from '../services/visits';
import { schedulesService } from '../services/schedules';
import { clientsService } from '../services/clients';
import { checklistsService } from '../services/checklists';
import { getUserOrganizationId } from '../lib/organization';
import { shiftPostingsService } from '../services/shiftPostings';
import { prisma } from '../lib/prisma';

const router = express.Router();

// All routes require authentication and manager role
router.use(authenticate);
router.use(requireRole('MANAGER', 'ADMIN'));

router.get('/teams/me', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }
    const teams = await prisma.team.findMany({
      where: { organizationId, managerId: req.userId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(teams);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Spec-aligned team overview (aggregates + today’s visits)
router.get('/overview/today', async (req: AuthRequest, res) => {
  try {
    const visits = await visitsService.getTodayVisits();
    const inProgress = visits.filter(
      (v: { status: string }) => v.status === 'IN_PROGRESS' || v.status === 'LATE'
    );
    const activeCarerIds = new Set(inProgress.map((v: { carerId: string }) => v.carerId));
    const byStatus = visits.reduce(
      (acc: Record<string, number>, v: { status: string }) => {
        acc[v.status] = (acc[v.status] || 0) + 1;
        return acc;
      },
      {}
    );
    res.json({
      activeCarers: activeCarerIds.size,
      visitsToday: visits.length,
      byStatus,
      visits,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Spec-aligned weekly team rota (all carers when carerId omitted)
router.get('/team-rota/week', async (req: AuthRequest, res) => {
  try {
    const start = req.query.start as string | undefined;
    const rota = await schedulesService.getWeeklyRota(undefined, start);
    res.json(rota);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Team visits overview
router.get('/visits/today', async (req: AuthRequest, res) => {
  try {
    const visits = await visitsService.getTodayVisits();
    res.json(visits);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

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

// Team schedules/rota
router.get('/schedules/weekly', async (req: AuthRequest, res) => {
  try {
    const rota = await schedulesService.getWeeklyRota(req.query.carerId as string, req.query.weekStart as string);
    res.json(rota);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/schedules', async (req: AuthRequest, res) => {
  try {
    const schedules = await schedulesService.getSchedules(undefined, req.query);
    res.json(schedules);
  } catch (error: any) {
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

// Open shifts (multi-carer postings; carers apply; staff assign)
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

// Clients management
router.get('/clients', async (req: AuthRequest, res) => {
  try {
    const clients = await clientsService.getClients();
    res.json(clients);
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

// Checklist templates
router.get('/checklists/templates', async (req: AuthRequest, res) => {
  try {
    const templates = await checklistsService.getTemplates(req.query.clientId as string);
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/checklists/templates', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const template = await checklistsService.createTemplate({ ...req.body, organizationId });
    res.status(201).json(template);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/checklists/templates/:id', async (req: AuthRequest, res) => {
  try {
    const template = await checklistsService.getTemplateById(req.params.id);
    res.json(template);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/checklists/templates/:id', async (req: AuthRequest, res) => {
  try {
    const template = await checklistsService.updateTemplate(req.params.id, req.body);
    res.json(template);
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

export default router;
