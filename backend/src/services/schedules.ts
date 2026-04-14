import { prisma } from '../lib/prisma';
import { UserRole } from '@prisma/client';
import { availabilityService } from './availability';

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

    await availabilityService.assertCanBookSchedule(data.carerId, startTime, endTime);

    const schedule = await prisma.schedule.create({
      data: {
        clientId: data.clientId,
        carerId: data.carerId,
        startTime,
        endTime,
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

