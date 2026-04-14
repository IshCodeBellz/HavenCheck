import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, isCarerScopedRole } from '../middleware/auth';
import { UserRole, VisitStatus } from '@prisma/client';
import { visitsService } from '../services/visits';
import { getUserOrganizationId } from '../lib/organization';

const router = express.Router();

const clockInSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  lateClockInReason: z.string().optional(),
});

const clockOutSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

// Get visits for current user (carer) or all visits (manager/admin)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    // Refresh time-based statuses before fetching
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    await prisma.visit.updateMany({
      where: {
        status: VisitStatus.NOT_STARTED,
        scheduledStart: {
          lte: now,
        },
        clockInTime: null,
      },
      data: {
        status: VisitStatus.LATE,
      },
    });
    await prisma.visit.updateMany({
      where: {
        status: VisitStatus.LATE,
        scheduledStart: {
          lte: oneHourAgo,
        },
        clockInTime: null,
      },
      data: {
        status: VisitStatus.MISSED,
      },
    });

    const { startDate, endDate, status, carerId, clientId } = req.query;

    const where: any = { client: { organizationId } };

    // Carers can only see their own visits
    if (isCarerScopedRole(req.userRole)) {
      where.carerId = req.userId;
    } else if (carerId) {
      where.carerId = carerId as string;
    }

    if (clientId) {
      where.clientId = clientId as string;
    }

    if (status) {
      where.status = status as VisitStatus;
    }

    if (startDate || endDate) {
      where.scheduledStart = {};
      if (startDate) {
        where.scheduledStart.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.scheduledStart.lte = new Date(endDate as string);
      }
    }

    const visits = await prisma.visit.findMany({
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
        checklistSubmissions: {
          include: {
            items: true,
          },
        },
        notes: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { scheduledStart: 'desc' },
    });

    res.json(visits);
  } catch (error) {
    console.error('Get visits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get today's visits for current user
router.get('/today', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const scopedCarerId = isCarerScopedRole(req.userRole) ? req.userId : undefined;
    const visits = await visitsService.getTodayVisits(scopedCarerId, organizationId);

    res.json(visits);
  } catch (error) {
    console.error('Get today visits error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get visit by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: {
        client: true,
        carer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        checklistSubmissions: {
          include: {
            template: {
              include: {
                items: true,
              },
            },
            items: true,
          },
          orderBy: { submittedAt: 'desc' },
        },
        notes: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Carers can only view their own visits
    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    res.json(visit);
  } catch (error) {
    console.error('Get visit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clock in
router.post('/:id/clock-in', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.userRole === UserRole.GUARDIAN) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Guardians cannot clock in' });
    }

    const { id } = req.params;
    const { latitude, longitude, lateClockInReason } = clockInSchema.parse(req.body);

    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Only the assigned carer can clock in
    if (visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to clock in for this visit' });
    }

    if (visit.clockInTime) {
      return res.status(400).json({ error: 'Already clocked in' });
    }

    // Enforce geofencing - require within 100m or client's configured radius
    const geofenceRadius = visit.client.geofenceRadiusMeters || 100; // Default to 100m
    if (!visit.client.latitude || !visit.client.longitude) {
      return res.status(400).json({ error: 'Client location not configured. Cannot clock in.' });
    }

      const distance = calculateDistance(
        latitude,
        longitude,
        visit.client.latitude,
        visit.client.longitude
      );

    if (distance > geofenceRadius) {
      return res.status(400).json({ 
        error: `You must be within ${geofenceRadius}m of the client location to clock in. Current distance: ${Math.round(distance)}m` 
      });
    }

    // Check time window: ±15 minutes from scheduled start time
    const now = new Date();
    let isLate = false;
    let requiresReason = false;
    let visitStatus: VisitStatus = VisitStatus.IN_PROGRESS;

    if (visit.scheduledStart) {
      const scheduledStart = new Date(visit.scheduledStart);
      const diffMinutes = (now.getTime() - scheduledStart.getTime()) / (1000 * 60);
      
      // Check if outside ±15 minute window
      if (Math.abs(diffMinutes) > 15) {
        if (diffMinutes > 15) {
          // Late clock-in
          isLate = true;
          requiresReason = true;
          
          if (!lateClockInReason || lateClockInReason.trim().length === 0) {
            return res.status(400).json({ 
              error: 'Clock-in is more than 15 minutes late. A reason is required.',
              requiresReason: true 
            });
          }
          
          // Mark as LATE - still in progress, just late
          visitStatus = VisitStatus.LATE;
        } else {
          // Too early (more than 15 minutes before)
          return res.status(400).json({ 
            error: 'Cannot clock in more than 15 minutes before scheduled start time' 
          });
        }
      }
    }

    const updatedVisit = await prisma.visit.update({
      where: { id },
      data: {
        clockInTime: now,
        clockInLat: latitude,
        clockInLng: longitude,
        withinGeofence: true,
        lateClockInReason: lateClockInReason || null,
        status: visitStatus,
      },
      include: {
        client: true,
        carer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(updatedVisit);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Clock in error:', error);
    // Provide more detailed error message
    const errorMessage = error?.message || 'Internal server error';
    const errorCode = error?.code || 'UNKNOWN_ERROR';
    res.status(500).json({ 
      error: 'Internal server error',
      message: errorMessage,
      code: errorCode
    });
  }
});

// Clock out
router.post('/:id/clock-out', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.userRole === UserRole.GUARDIAN) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Guardians cannot clock out' });
    }

    const { id } = req.params;
    const { latitude, longitude } = clockOutSchema.parse(req.body);

    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { client: { select: { organizationId: true } } },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Only the assigned carer can clock out
    if (visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to clock out for this visit' });
    }

    if (!visit.clockInTime) {
      return res.status(400).json({ error: 'Must clock in first' });
    }

    if (visit.clockOutTime) {
      return res.status(400).json({ error: 'Already clocked out' });
    }

    const updatedVisit = await prisma.visit.update({
      where: { id },
      data: {
        clockOutTime: new Date(),
        clockOutLat: latitude,
        clockOutLng: longitude,
        status: 'COMPLETED',
      },
      include: {
        client: true,
        carer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(updatedVisit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default router;

