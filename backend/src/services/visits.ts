import { prisma } from '../lib/prisma';
import { VisitStatus } from '@prisma/client';

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

// Helper function to keep NOT_STARTED visits in sync with time-based status rules.
// - LATE: scheduled start time has passed and still not clocked in
// - MISSED: more than 1 hour after scheduled start and still not clocked in
async function updateOverdueVisitStatuses() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

  try {
    // First mark visits as LATE once they pass scheduled start.
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

    // Then escalate overdue late visits to MISSED after 1 hour.
    await prisma.visit.updateMany({
      where: {
        status: VisitStatus.LATE,
        scheduledStart: {
          lte: oneHourAgo, // Scheduled start was more than 1 hour ago
        },
        clockInTime: null, // Not clocked in
      },
      data: {
        status: VisitStatus.MISSED,
      },
    });
  } catch (error) {
    // Log error but don't throw - we don't want to break the main query
    console.error('Error updating overdue visit statuses:', error);
  }
}

export const visitsService = {
  async getTodayVisits(carerId?: string, organizationId?: string) {
    // Refresh time-based statuses before fetching
    await updateOverdueVisitStatuses();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      scheduledStart: {
        gte: today,
        lt: tomorrow,
      },
    };

    const scheduleWhere: any = {
      startTime: {
        gte: today,
        lt: tomorrow,
      },
    };

    if (organizationId) {
      where.client = { organizationId };
      scheduleWhere.client = { organizationId };
    }

    if (carerId) {
      where.carerId = carerId;
      scheduleWhere.carerId = carerId;
    }

    const schedules = await prisma.schedule.findMany({
      where: scheduleWhere,
      select: {
        clientId: true,
        carerId: true,
        startTime: true,
        endTime: true,
      },
    });

    // Reconcile stale/missing pending visits from today's schedules.
    // This keeps My Day consistent even if historical schedule edits left visits out of sync.
    for (const schedule of schedules) {
      await prisma.visit.updateMany({
        where: {
          clientId: schedule.clientId,
          scheduledStart: schedule.startTime,
          scheduledEnd: schedule.endTime,
          clockInTime: null,
          clockOutTime: null,
          NOT: {
            carerId: schedule.carerId,
          },
        },
        data: {
          carerId: schedule.carerId,
        },
      });

      const existingVisit = await prisma.visit.findFirst({
        where: {
          clientId: schedule.clientId,
          carerId: schedule.carerId,
          scheduledStart: schedule.startTime,
          scheduledEnd: schedule.endTime,
        },
        select: { id: true },
      });

      if (!existingVisit) {
        await prisma.visit.create({
          data: {
            clientId: schedule.clientId,
            carerId: schedule.carerId,
            scheduledStart: schedule.startTime,
            scheduledEnd: schedule.endTime,
            status: VisitStatus.NOT_STARTED,
          },
        });
      }
    }

    return await prisma.visit.findMany({
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
      orderBy: { scheduledStart: 'asc' },
    });
  },

  async getVisits(carerId: string | undefined, query: any) {
    // Refresh time-based statuses before fetching
    await updateOverdueVisitStatuses();

    const { startDate, endDate, status, clientId } = query;

    const where: any = {};

    if (carerId) {
      where.carerId = carerId;
    } else if (query.carerId) {
      where.carerId = query.carerId as string;
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

    return await prisma.visit.findMany({
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
  },

  async getVisitById(id: string, carerId?: string) {
    const visit = await prisma.visit.findUnique({
      where: { id },
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
      const error: any = new Error('Visit not found');
      error.status = 404;
      throw error;
    }

    if (carerId && visit.carerId !== carerId) {
      const error: any = new Error('Not authorized to view this visit');
      error.status = 403;
      throw error;
    }

    return visit;
  },

  async clockIn(visitId: string, carerId: string, data: { latitude: number; longitude: number }) {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { client: true },
    });

    if (!visit) {
      const error: any = new Error('Visit not found');
      error.status = 404;
      throw error;
    }

    if (visit.carerId !== carerId) {
      const error: any = new Error('Not authorized to clock in for this visit');
      error.status = 403;
      error.error = 'FORBIDDEN';
      throw error;
    }

    if (visit.clockInTime) {
      const error: any = new Error('Already clocked in');
      error.status = 400;
      error.error = 'BAD_REQUEST';
      throw error;
    }

    let withinGeofence: boolean | null = null;
    if (visit.client.latitude && visit.client.longitude && visit.client.geofenceRadiusMeters) {
      const distance = calculateDistance(
        data.latitude,
        data.longitude,
        visit.client.latitude,
        visit.client.longitude
      );
      withinGeofence = distance <= visit.client.geofenceRadiusMeters;
    }

    return await prisma.visit.update({
      where: { id: visitId },
      data: {
        clockInTime: new Date(),
        clockInLat: data.latitude,
        clockInLng: data.longitude,
        withinGeofence,
        status: 'IN_PROGRESS',
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
  },

  async clockOut(visitId: string, carerId: string, data: { latitude: number; longitude: number }) {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      const error: any = new Error('Visit not found');
      error.status = 404;
      throw error;
    }

    if (visit.carerId !== carerId) {
      const error: any = new Error('Not authorized to clock out for this visit');
      error.status = 403;
      error.error = 'FORBIDDEN';
      throw error;
    }

    if (!visit.clockInTime) {
      const error: any = new Error('Must clock in first');
      error.status = 400;
      error.error = 'BAD_REQUEST';
      throw error;
    }

    if (visit.clockOutTime) {
      const error: any = new Error('Already clocked out');
      error.status = 400;
      error.error = 'BAD_REQUEST';
      throw error;
    }

    return await prisma.visit.update({
      where: { id: visitId },
      data: {
        clockOutTime: new Date(),
        clockOutLat: data.latitude,
        clockOutLng: data.longitude,
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
  },

  async getTimesheetReport(query: { from?: string; to?: string; carerId?: string }) {
    await updateOverdueVisitStatuses();

    const where: any = {
      clockInTime: { not: null },
      clockOutTime: { not: null },
    };

    if (query.carerId) {
      where.carerId = query.carerId;
    }

    if (query.from || query.to) {
      where.scheduledStart = {};
      if (query.from) {
        where.scheduledStart.gte = new Date(query.from);
      }
      if (query.to) {
        const end = new Date(query.to);
        end.setHours(23, 59, 59, 999);
        where.scheduledStart.lte = end;
      }
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        carer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { scheduledStart: 'desc' },
    });

    const rows = visits.map((v) => {
      const ms = v.clockOutTime!.getTime() - v.clockInTime!.getTime();
      return {
        visitId: v.id,
        carerId: v.carerId,
        carerName: v.carer.name,
        clientName: v.client.name,
        scheduledStart: v.scheduledStart?.toISOString() ?? '',
        clockInTime: v.clockInTime!.toISOString(),
        clockOutTime: v.clockOutTime!.toISOString(),
        minutes: Math.round(ms / 60000),
      };
    });

    const byCarerMap = new Map<
      string,
      { carerId: string; carerName: string; totalMinutes: number; visitCount: number }
    >();
    for (const r of rows) {
      const cur = byCarerMap.get(r.carerId) || {
        carerId: r.carerId,
        carerName: r.carerName,
        totalMinutes: 0,
        visitCount: 0,
      };
      cur.totalMinutes += r.minutes;
      cur.visitCount += 1;
      byCarerMap.set(r.carerId, cur);
    }

    return {
      rows,
      summary: Array.from(byCarerMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes),
    };
  },
};

