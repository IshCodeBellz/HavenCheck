import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, isCarerScopedRole } from '../middleware/auth';
import { CarePlanStatus, MedicationAlertType, MedicationEventStatus, UserRole, VisitStatus } from '@prisma/client';
import { visitsService } from '../services/visits';
import { getUserOrganizationId } from '../lib/organization';
import { isScheduleDueDuringVisit } from '../lib/medicationDue';
import { attachStockFields } from '../lib/medicationStockSerialize';
import { medicationAlertService } from '../services/medicationAlertService';
import { auditLogService } from '../services/auditLogService';

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

const medicationEventSchema = z.object({
  medicationId: z.string().min(1),
  scheduleId: z.string().optional(),
  status: z.nativeEnum(MedicationEventStatus),
  note: z.string().trim().optional(),
  reasonCode: z.string().trim().optional(),
  prnIndication: z.string().trim().optional(),
  dosageGiven: z.string().trim().optional(),
  signatureImage: z.string().trim().optional(),
  effectivenessNote: z.string().trim().optional(),
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
        medicationEvents: {
          where: { deletedAt: null },
          include: {
            medication: true,
            schedule: true,
            recordedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { administeredAt: 'desc' },
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

/** Read-only active structured care plan for the visit's client (carers and staff with visit access). */
router.get('/:id/care-plan', authenticate, async (req: AuthRequest, res) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: {
        client: { select: { id: true, organizationId: true, name: true } },
      },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const carePlan = await prisma.carePlan.findFirst({
      where: {
        organizationId,
        clientId: visit.client.id,
        status: CarePlanStatus.ACTIVE,
      },
      include: {
        currentVersion: {
          include: {
            sections: { orderBy: [{ sectionType: 'asc' }, { orderIndex: 'asc' }] },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      client: { id: visit.client.id, name: visit.client.name },
      carePlan,
    });
  } catch (error) {
    console.error('Get visit care plan error:', error);
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
        medicationEvents: {
          where: { deletedAt: null },
          include: {
            medication: true,
            schedule: true,
            recordedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { administeredAt: 'desc' },
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

router.get('/:id/medications', authenticate, async (req: AuthRequest, res) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: { id: true, organizationId: true },
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

    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const medications = await prisma.medication.findMany({
      where: {
        organizationId,
        clientId: visit.clientId,
        active: true,
      },
      include: {
        stock: true,
        schedules: {
          where: { active: true },
          orderBy: { timeOfDay: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(medications.map((m) => attachStockFields(m)));
  } catch (error) {
    console.error('Get visit medications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/due-medications', authenticate, async (req: AuthRequest, res) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: {
        client: {
          select: { id: true, organizationId: true },
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

    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const dayOfWeek = (visit.scheduledStart ?? visit.clockInTime ?? new Date()).getDay().toString();
    const medications = await prisma.medication.findMany({
      where: {
        organizationId,
        clientId: visit.clientId,
        active: true,
      },
      include: {
        stock: true,
        schedules: {
          where: {
            active: true,
            OR: [{ daysOfWeek: { has: dayOfWeek } }, { daysOfWeek: { isEmpty: true } }],
          },
          orderBy: { timeOfDay: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const visitWindowInput = {
      scheduledStart: visit.scheduledStart,
      scheduledEnd: visit.scheduledEnd,
      clockInTime: visit.clockInTime,
    };

    const due = medications
      .map((med) => {
        if (med.isPrn) {
          return attachStockFields(med);
        }
        const schedulesInWindow = med.schedules.filter((s) =>
          isScheduleDueDuringVisit(visitWindowInput, s)
        );
        return attachStockFields({ ...med, schedules: schedulesInWindow });
      })
      .filter((m) => m.isPrn || m.schedules.length > 0);

    res.json(due);
  } catch (error) {
    console.error('Get due medications error:', error);
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

    const updatedVisit = await visitsService.clockOut(id, req.userId!, { latitude, longitude });

    res.json(updatedVisit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Clock out error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/med-events', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.userRole === UserRole.GUARDIAN) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Guardians cannot record medication events' });
    }

    const { id: visitId } = req.params;
    const payload = medicationEventSchema.parse(req.body);

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: {
        client: {
          select: { id: true, organizationId: true },
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

    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const medication = await prisma.medication.findFirst({
      where: {
        id: payload.medicationId,
        clientId: visit.clientId,
        organizationId,
        active: true,
      },
      include: {
        stock: true,
        client: { select: { id: true, name: true } },
      },
    });

    if (!medication) {
      return res.status(400).json({ error: 'Invalid medication for this visit/client' });
    }

    if (payload.status === MedicationEventStatus.OMITTED && !payload.reasonCode) {
      return res.status(400).json({ error: 'Reason code is required when medication is omitted' });
    }
    if (payload.status === MedicationEventStatus.ADMINISTERED && !payload.signatureImage?.trim()) {
      return res.status(400).json({ error: 'Signature is required when medication is administered' });
    }
    if (medication.isPrn && payload.status === MedicationEventStatus.ADMINISTERED && !payload.prnIndication) {
      return res.status(400).json({ error: 'PRN indication is required when administering PRN medication' });
    }
    if (medication.isPrn && payload.status === MedicationEventStatus.ADMINISTERED && !payload.dosageGiven?.trim()) {
      return res.status(400).json({ error: 'Dosage given is required when administering PRN medication' });
    }

    let validatedScheduleId: string | null = null;
    if (payload.scheduleId) {
      const schedule = await prisma.medicationSchedule.findFirst({
        where: {
          id: payload.scheduleId,
          medicationId: payload.medicationId,
          organizationId,
          active: true,
        },
        select: { id: true },
      });
      if (!schedule) {
        return res.status(400).json({ error: 'Invalid medication schedule' });
      }
      validatedScheduleId = schedule.id;
    }

    const lowStockRef: {
      current: {
        organizationId: string;
        medicationId: string;
        clientId: string;
        name: string;
        clientName: string;
        currentStock: number;
        reorderThreshold: number;
      } | null;
    } = { current: null };

    const event = await prisma.$transaction(async (tx) => {
      const createdEvent = await tx.medicationEvent.create({
        data: {
          organizationId,
          visitId: visit.id,
          clientId: visit.clientId,
          medicationId: payload.medicationId,
          scheduleId: validatedScheduleId,
          status: payload.status,
          note: payload.note || null,
          reasonCode: payload.reasonCode || null,
          prnIndication: payload.prnIndication || null,
          dosageGiven: payload.dosageGiven || null,
          signatureImage: payload.signatureImage || null,
          signedAt: payload.status === MedicationEventStatus.ADMINISTERED ? new Date() : null,
          signedByUserId: payload.status === MedicationEventStatus.ADMINISTERED ? req.userId! : null,
          effectivenessNote: payload.effectivenessNote || null,
          recordedById: req.userId!,
        },
        include: {
          medication: true,
          schedule: true,
          recordedBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await tx.medicationAuditLog.create({
        data: {
          organizationId,
          medicationId: createdEvent.medicationId,
          medicationEventId: createdEvent.id,
          action: 'MEDICATION_EVENT_CREATED',
          actorId: req.userId!,
          payload: {
            visitId: createdEvent.visitId,
            status: createdEvent.status,
            reasonCode: createdEvent.reasonCode,
            prnIndication: createdEvent.prnIndication,
            dosageGiven: createdEvent.dosageGiven,
            signedAt: createdEvent.signedAt,
          },
        },
      });

      if (createdEvent.status === MedicationEventStatus.ADMINISTERED && medication.stock?.currentStock !== null) {
        const updatedStock = await tx.medicationStock.update({
          where: { medicationId: medication.id },
          data: { currentStock: { decrement: 1 } },
          select: { currentStock: true, reorderThreshold: true },
        });

        await tx.medicationAuditLog.create({
          data: {
            organizationId,
            medicationId: medication.id,
            medicationEventId: createdEvent.id,
            action: 'MEDICATION_STOCK_DEDUCTED',
            actorId: req.userId!,
            payload: {
              medicationName: medication.name,
              currentStock: updatedStock.currentStock,
            },
          },
        });

        if (
          updatedStock.currentStock !== null &&
          updatedStock.reorderThreshold !== null &&
          updatedStock.currentStock <= updatedStock.reorderThreshold
        ) {
          await tx.medicationAuditLog.create({
            data: {
              organizationId,
              medicationId: medication.id,
              medicationEventId: createdEvent.id,
              action: 'MEDICATION_REORDER_ALERT',
              actorId: req.userId!,
              payload: {
                medicationName: medication.name,
                currentStock: updatedStock.currentStock,
                reorderThreshold: updatedStock.reorderThreshold,
              },
            },
          });
          lowStockRef.current = {
            organizationId,
            medicationId: medication.id,
            clientId: visit.clientId,
            name: medication.name,
            clientName: medication.client.name,
            currentStock: updatedStock.currentStock,
            reorderThreshold: updatedStock.reorderThreshold,
          };
        }
      }

      return createdEvent;
    });

    if (lowStockRef.current) {
      const n = lowStockRef.current;
      await medicationAlertService.tryCreateAndNotify({
        organizationId: n.organizationId,
        type: MedicationAlertType.LOW_STOCK,
        medicationId: n.medicationId,
        clientId: n.clientId,
        dedupeKey: `LOW_STOCK:${n.medicationId}`,
        title: 'Low medication stock',
        detail: `${n.name} for ${n.clientName}: ${n.currentStock} remaining (reorder at ${n.reorderThreshold}).`,
      });
    }

    await auditLogService.log({
      organizationId,
      module: 'medications',
      action: 'MEDICATION_EVENT_RECORDED',
      entityType: 'MedicationEvent',
      entityId: event.id,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      afterData: {
        visitId: event.visitId,
        clientId: event.clientId,
        medicationId: event.medicationId,
        status: event.status,
        administeredAt: event.administeredAt,
      },
    });

    res.status(201).json(event);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create medication event error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/med-events/:eventId', authenticate, async (req: AuthRequest, res) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: { client: { select: { organizationId: true } } },
    });
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    await prisma.medicationAuditLog.create({
      data: {
        organizationId,
        medicationEventId: req.params.eventId,
        action: 'MEDICATION_EVENT_UPDATE_ATTEMPT_BLOCKED',
        actorId: req.userId!,
        payload: { visitId: req.params.id, attemptedPayload: req.body ?? null },
      },
    });

    await auditLogService.log({
      organizationId,
      module: 'medications',
      action: 'MEDICATION_EVENT_UPDATE_BLOCKED',
      entityType: 'MedicationEvent',
      entityId: req.params.eventId,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      metadata: { visitId: req.params.id },
    });

    return res.status(409).json({ error: 'Medication events are immutable once created' });
  } catch (error) {
    console.error('Medication event update attempt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id/med-events/:eventId', authenticate, async (req: AuthRequest, res) => {
  try {
    const visit = await prisma.visit.findUnique({
      where: { id: req.params.id },
      include: { client: { select: { organizationId: true } } },
    });
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const event = await prisma.medicationEvent.findFirst({
      where: {
        id: req.params.eventId,
        visitId: req.params.id,
        organizationId,
        deletedAt: null,
      },
      select: { id: true, medicationId: true },
    });
    if (!event) return res.status(404).json({ error: 'Medication event not found' });

    await prisma.$transaction(async (tx) => {
      await tx.medicationEvent.update({
        where: { id: event.id },
        data: {
          deletedAt: new Date(),
          deletedById: req.userId!,
        },
      });
      await tx.medicationAuditLog.create({
        data: {
          organizationId,
          medicationId: event.medicationId,
          medicationEventId: event.id,
          action: 'MEDICATION_EVENT_SOFT_DELETED',
          actorId: req.userId!,
          payload: { visitId: req.params.id },
        },
      });
    });

    await auditLogService.log({
      organizationId,
      module: 'medications',
      action: 'MEDICATION_EVENT_SOFT_DELETED',
      entityType: 'MedicationEvent',
      entityId: event.id,
      actorId: req.userId!,
      actorRole: req.userRole,
      route: req.path,
      method: req.method,
      metadata: { visitId: req.params.id, medicationId: event.medicationId },
    });

    return res.status(200).json({ ok: true, softDeleted: true });
  } catch (error) {
    console.error('Medication event soft delete error:', error);
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

