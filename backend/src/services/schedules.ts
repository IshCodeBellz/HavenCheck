import { prisma } from '../lib/prisma';
import { UserRole } from '@prisma/client';
import { availabilityService } from './availability';

const EARTH_RADIUS_MILES = 3958.8;
const AVG_CARE_MPH = 24;

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineMiles(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

function estimateTravelMinutes(distanceMiles: number): number {
  return Math.max(2, Math.round((distanceMiles / AVG_CARE_MPH) * 60));
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && endA > startB;
}

async function validateClientSkillMatch(carerId: string, clientId: string) {
  const [client, carer] = await Promise.all([
    (prisma as any).client.findUnique({
      where: { id: clientId },
      select: { id: true, requiredDbs: true, requiredCertifications: true },
    }),
    (prisma as any).user.findUnique({
      where: { id: carerId },
      select: { id: true, dbsVerified: true, certifications: true },
    }),
  ]);

  if (!client || !carer) {
    const err: any = new Error('Client or carer not found');
    err.status = 400;
    throw err;
  }

  const requiredCerts: string[] = Array.isArray(client.requiredCertifications)
    ? client.requiredCertifications
    : [];
  const carerCerts = new Set<string>(Array.isArray(carer.certifications) ? carer.certifications : []);

  if (client.requiredDbs && !carer.dbsVerified) {
    const err: any = new Error('Carer does not meet DBS requirement for this client');
    err.status = 400;
    err.code = 'SKILL_MISMATCH_DBS';
    throw err;
  }

  const missingCerts = requiredCerts.filter((cert) => !carerCerts.has(cert));
  if (missingCerts.length > 0) {
    const err: any = new Error(`Carer missing required certifications: ${missingCerts.join(', ')}`);
    err.status = 400;
    err.code = 'SKILL_MISMATCH_CERTIFICATION';
    throw err;
  }
}

export const schedulesService = {
  async getWeeklyRota(carerId: string | undefined, weekStart?: string) {
    let startDate: Date;
    if (weekStart) {
      startDate = new Date(weekStart);
    } else {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(today.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const where: any = {
      startTime: {
        gte: startDate,
        lt: endDate,
      },
    };

    if (carerId) {
      where.carerId = carerId;
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

    const groupedByDay: Record<string, typeof schedules> = {};
    schedules.forEach((schedule) => {
      const dayKey = schedule.startTime.toISOString().split('T')[0];
      if (!groupedByDay[dayKey]) {
        groupedByDay[dayKey] = [];
      }
      groupedByDay[dayKey].push(schedule);
    });

    return {
      weekStart: startDate.toISOString(),
      schedules: groupedByDay,
    };
  },

  async getScheduleById(id: string) {
    const schedule = await prisma.schedule.findUnique({
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
      },
    });

    if (!schedule) {
      const error: any = new Error('Schedule not found');
      error.status = 404;
      throw error;
    }

    return schedule;
  },

  async getSchedules(carerId: string | undefined, query: any) {
    const { startDate, endDate, clientId } = query;

    const where: any = {};

    if (carerId) {
      where.carerId = carerId;
    } else if (query.carerId) {
      where.carerId = query.carerId as string;
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

    return await prisma.schedule.findMany({
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
  },

  async createSchedule(
    data: {
      clientId: string;
      carerId: string;
      startTime: string;
      endTime: string;
    },
    opts?: { organizationId?: string }
  ) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
      const err: any = new Error('Invalid start or end time');
      err.status = 400;
      throw err;
    }

    if (opts?.organizationId) {
      const [client, carer] = await Promise.all([
        prisma.client.findFirst({
          where: { id: data.clientId, organizationId: opts.organizationId, active: true },
          select: { id: true },
        }),
        prisma.user.findFirst({
          where: {
            id: data.carerId,
            organizationId: opts.organizationId,
            role: UserRole.CARER,
            isActive: true,
          },
          select: { id: true },
        }),
      ]);
      if (!client || !carer) {
        const err: any = new Error('Client and carer must belong to your organisation');
        err.status = 400;
        throw err;
      }
    }

    await validateClientSkillMatch(data.carerId, data.clientId);
    await availabilityService.assertCanBookSchedule(data.carerId, startTime, endTime);

    const neighbouringSchedules = await prisma.schedule.findMany({
      where: {
        carerId: data.carerId,
        startTime: {
          gte: new Date(startTime.getTime() - 1000 * 60 * 60 * 16),
          lte: new Date(startTime.getTime() + 1000 * 60 * 60 * 16),
        },
      },
      include: {
        client: {
          select: { latitude: true, longitude: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    let travelDistanceMiles: number | null = null;
    let travelDurationMinutes: number | null = null;
    const previous = neighbouringSchedules
      .filter((s) => s.endTime <= startTime)
      .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())[0];
    const sourceCoords = previous?.client;
    const targetClient = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { latitude: true, longitude: true },
    });
    if (
      sourceCoords?.latitude != null &&
      sourceCoords?.longitude != null &&
      targetClient?.latitude != null &&
      targetClient?.longitude != null
    ) {
      travelDistanceMiles = haversineMiles(
        { latitude: sourceCoords.latitude, longitude: sourceCoords.longitude },
        { latitude: targetClient.latitude, longitude: targetClient.longitude }
      );
      travelDurationMinutes = estimateTravelMinutes(travelDistanceMiles);
    }

    const schedule = await (prisma as any).schedule.create({
      data: {
        clientId: data.clientId,
        carerId: data.carerId,
        startTime,
        endTime,
        travelDistanceMiles: travelDistanceMiles ?? undefined,
        travelDurationMinutes: travelDurationMinutes ?? undefined,
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

    // Generate visit from schedule
    await prisma.visit.create({
      data: {
        clientId: schedule.clientId,
        carerId: schedule.carerId,
        scheduledStart: schedule.startTime,
        scheduledEnd: schedule.endTime,
        status: 'NOT_STARTED',
      },
    });

    return schedule;
  },

  async updateSchedule(id: string, data: any, opts?: { organizationId?: string }) {
    const schedule = await (prisma as any).schedule.findFirst({
      where: {
        id,
        ...(opts?.organizationId ? { client: { organizationId: opts.organizationId } } : {}),
      },
    });
    if (!schedule) {
      const error: any = new Error('Schedule not found');
      error.status = 404;
      throw error;
    }

    if (opts?.organizationId && data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, organizationId: opts.organizationId, active: true },
        select: { id: true },
      });
      if (!client) {
        const err: any = new Error('Client must belong to your organisation');
        err.status = 400;
        throw err;
      }
    }
    if (opts?.organizationId && data.carerId) {
      const carer = await prisma.user.findFirst({
        where: {
          id: data.carerId,
          organizationId: opts.organizationId,
          role: UserRole.CARER,
          isActive: true,
        },
        select: { id: true },
      });
      if (!carer) {
        const err: any = new Error('Carer must belong to your organisation');
        err.status = 400;
        throw err;
      }
    }

    const updateData: any = {};
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);
    if (data.clientId) updateData.clientId = data.clientId;
    if (typeof data.travelDistanceMiles === 'number') updateData.travelDistanceMiles = data.travelDistanceMiles;
    if (typeof data.travelDurationMinutes === 'number') {
      updateData.travelDurationMinutes = data.travelDurationMinutes;
    }
    if (Array.isArray(data.conflictFlags)) updateData.conflictFlags = data.conflictFlags;

    const carerId = data.carerId || schedule.carerId;
    const startTime = updateData.startTime || schedule.startTime;
    const endTime = updateData.endTime || schedule.endTime;

    if (data.carerId || data.startTime || data.endTime) {
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
        const err: any = new Error('Invalid start or end time');
        err.status = 400;
        throw err;
      }
      await availabilityService.assertCanBookSchedule(carerId, startTime, endTime);
    }
    if (data.carerId || data.clientId) {
      await validateClientSkillMatch(carerId, data.clientId || schedule.clientId);
    }

    if (data.carerId) updateData.carerId = data.carerId;

    const updatedSchedule = await prisma.$transaction(async (tx) => {
      const savedSchedule = await tx.schedule.update({
        where: { id },
        data: updateData,
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

      // Keep pending generated visit aligned with edited schedule assignment/times.
      await tx.visit.updateMany({
        where: {
          clientId: schedule.clientId,
          carerId: schedule.carerId,
          scheduledStart: schedule.startTime,
          scheduledEnd: schedule.endTime,
          clockInTime: null,
          clockOutTime: null,
        },
        data: {
          clientId: savedSchedule.clientId,
          carerId: savedSchedule.carerId,
          scheduledStart: savedSchedule.startTime,
          scheduledEnd: savedSchedule.endTime,
        },
      });

      return savedSchedule;
    });

    return updatedSchedule;
  },

  async reassignSchedule(
    id: string,
    data: { carerId: string; startTime?: string; endTime?: string },
    opts?: { organizationId?: string }
  ) {
    const schedule = await (prisma as any).schedule.findFirst({
      where: {
        id,
        ...(opts?.organizationId ? { client: { organizationId: opts.organizationId } } : {}),
      },
      include: {
        client: { select: { id: true, latitude: true, longitude: true } },
      },
    });
    if (!schedule) {
      const error: any = new Error('Schedule not found');
      error.status = 404;
      throw error;
    }

    const startTime = data.startTime ? new Date(data.startTime) : schedule.startTime;
    const endTime = data.endTime ? new Date(data.endTime) : schedule.endTime;
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
      const err: any = new Error('Invalid start or end time');
      err.status = 400;
      throw err;
    }

    await validateClientSkillMatch(data.carerId, schedule.clientId);
    await availabilityService.assertCanBookSchedule(data.carerId, startTime, endTime);

    const nearby = await prisma.schedule.findMany({
      where: {
        carerId: data.carerId,
        id: { not: id },
        startTime: { gte: new Date(startTime.getTime() - 1000 * 60 * 60 * 16) },
        endTime: { lte: new Date(endTime.getTime() + 1000 * 60 * 60 * 16) },
      },
      include: { client: { select: { latitude: true, longitude: true } } },
      orderBy: { startTime: 'asc' },
    });

    const conflicts = nearby.filter((s) => overlaps(startTime, endTime, s.startTime, s.endTime));
    if (conflicts.length > 0) {
      const err: any = new Error('Assignment conflicts with existing rota slots');
      err.status = 400;
      err.code = 'CONFLICT';
      throw err;
    }

    const previous = nearby
      .filter((s) => s.endTime <= startTime)
      .sort((a, b) => b.endTime.getTime() - a.endTime.getTime())[0];
    let travelDistanceMiles: number | undefined;
    let travelDurationMinutes: number | undefined;
    if (
      previous?.client?.latitude != null &&
      previous.client.longitude != null &&
      schedule.client.latitude != null &&
      schedule.client.longitude != null
    ) {
      travelDistanceMiles = haversineMiles(
        { latitude: previous.client.latitude, longitude: previous.client.longitude },
        { latitude: schedule.client.latitude, longitude: schedule.client.longitude }
      );
      travelDurationMinutes = estimateTravelMinutes(travelDistanceMiles);
    }

    return this.updateSchedule(
      id,
      {
        carerId: data.carerId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        travelDistanceMiles,
        travelDurationMinutes,
        conflictFlags: [],
      },
      opts
    );
  },

  async getSmartCandidates(scheduleId: string, opts?: { organizationId?: string }) {
    const schedule = await prisma.schedule.findFirst({
      where: {
        id: scheduleId,
        ...(opts?.organizationId ? { client: { organizationId: opts.organizationId } } : {}),
      },
      include: {
        client: {
          select: { id: true, latitude: true, longitude: true, requiredDbs: true, requiredCertifications: true },
        },
      },
    });
    if (!schedule) {
      const err: any = new Error('Schedule not found');
      err.status = 404;
      throw err;
    }

    const carers = await (prisma as any).user.findMany({
      where: {
        role: UserRole.CARER,
        isActive: true,
        ...(opts?.organizationId ? { organizationId: opts.organizationId } : {}),
      },
      select: {
        id: true,
        name: true,
        dbsVerified: true,
        certifications: true,
        preferredClientIds: true,
      },
      orderBy: { name: 'asc' },
    });

    const reqCerts: string[] = Array.isArray(schedule.client.requiredCertifications)
      ? schedule.client.requiredCertifications
      : [];

    const scored = await Promise.all(
      carers.map(async (carer: any) => {
        const certs = new Set<string>(Array.isArray(carer.certifications) ? carer.certifications : []);
        const missingCerts = reqCerts.filter((c) => !certs.has(c));
        const hasDbs = !schedule.client.requiredDbs || !!carer.dbsVerified;
        const skillsEligible = hasDbs && missingCerts.length === 0;

        const conflict = await prisma.schedule.findFirst({
          where: {
            carerId: carer.id,
            id: { not: schedule.id },
            startTime: { lt: schedule.endTime },
            endTime: { gt: schedule.startTime },
          },
          select: { id: true },
        });

        let preferenceBoost = 0;
        if (Array.isArray(carer.preferredClientIds) && carer.preferredClientIds.includes(schedule.client.id)) {
          preferenceBoost = 15;
        }

        const baseScore = (skillsEligible ? 70 : 0) + (conflict ? 0 : 15) + preferenceBoost;
        return {
          carerId: carer.id,
          carerName: carer.name,
          score: baseScore,
          isAvailable: !conflict,
          skillsEligible,
          missingCertifications: missingCerts,
          missingDbs: !hasDbs,
          preferredClient: preferenceBoost > 0,
        };
      })
    );

    return scored.sort((a, b) => b.score - a.score);
  },

  async deleteSchedule(id: string, opts?: { organizationId?: string }) {
    const schedule = await prisma.schedule.findFirst({
      where: {
        id,
        ...(opts?.organizationId ? { client: { organizationId: opts.organizationId } } : {}),
      },
    });
    if (!schedule) {
      const error: any = new Error('Schedule not found');
      error.status = 404;
      throw error;
    }

    await prisma.schedule.delete({
      where: { id },
    });
  },
};

