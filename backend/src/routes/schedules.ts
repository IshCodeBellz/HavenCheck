import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest, isCarerScopedRole } from '../middleware/auth';
import { getUserOrganizationId } from '../lib/organization';
import { schedulesService } from '../services/schedules';

const router = express.Router();

const createScheduleSchema = z.object({
  clientId: z.string(),
  carerId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});

const updateScheduleSchema = createScheduleSchema.partial();

// Get schedules
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const { startDate, endDate, carerId, clientId } = req.query;

    const where: any = { client: { organizationId } };

    // Carers can only see their own schedules
    if (isCarerScopedRole(req.userRole)) {
      where.carerId = req.userId;
    } else if (carerId) {
      where.carerId = carerId as string;
    }

    if (clientId) {
      where.clientId = clientId as string;
    }

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) {
        where.startTime.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.startTime.lte = new Date(endDate as string);
      }
    }

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        client: true,
        carer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    res.json(schedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get weekly rota for current user or specific carer
router.get('/weekly', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const { carerId, weekStart } = req.query;

    let targetCarerId = req.userId;
    if (!isCarerScopedRole(req.userRole) && carerId) {
      targetCarerId = carerId as string;
    }

    // Calculate week start (Monday)
    let startDate: Date;
    if (weekStart) {
      startDate = new Date(weekStart as string);
    } else {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
      startDate = new Date(today.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const schedules = await prisma.schedule.findMany({
      where: {
        client: { organizationId },
        carerId: targetCarerId,
        startTime: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        client: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // Group by day
    const groupedByDay: Record<string, typeof schedules> = {};
    schedules.forEach((schedule) => {
      const dayKey = schedule.startTime.toISOString().split('T')[0];
      if (!groupedByDay[dayKey]) {
        groupedByDay[dayKey] = [];
      }
      groupedByDay[dayKey].push(schedule);
    });

    res.json({
      weekStart: startDate.toISOString(),
      schedules: groupedByDay,
    });
  } catch (error) {
    console.error('Get weekly rota error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get schedule by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const schedule = await prisma.schedule.findFirst({
      where: { id: req.params.id, client: { organizationId } },
      include: {
        client: true,
        carer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    res.json(schedule);
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create schedule (Admin/Manager only)
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const organizationId = await getUserOrganizationId((req as AuthRequest).userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const data = createScheduleSchema.parse(req.body);
    const schedule = await schedulesService.createSchedule(data, { organizationId });
    res.status(201).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    const err = error as { status?: number; message?: string; code?: string };
    if (err.status === 400) {
      return res.status(400).json({ error: err.code || 'UNAVAILABLE', message: err.message });
    }
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update schedule (Admin/Manager only)
router.patch('/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const organizationId = await getUserOrganizationId((req as AuthRequest).userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const { id } = req.params;
    const data = updateScheduleSchema.parse(req.body);
    const schedule = await schedulesService.updateSchedule(id, data, { organizationId });
    res.json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    const err = error as { status?: number; message?: string; code?: string };
    if (err.status === 404) {
      return res.status(404).json({ error: 'Schedule not found', message: err.message });
    }
    if (err.status === 400) {
      return res.status(400).json({ error: err.code || 'UNAVAILABLE', message: err.message });
    }
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete schedule (Admin/Manager only)
router.delete('/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const organizationId = await getUserOrganizationId((req as AuthRequest).userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    await schedulesService.deleteSchedule(req.params.id, { organizationId });
    res.json({ message: 'Schedule deleted' });
  } catch (error) {
    const err = error as { status?: number; message?: string };
    if (err.status === 404) {
      return res.status(404).json({ error: 'Schedule not found', message: err.message });
    }
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

