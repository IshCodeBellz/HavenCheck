import {
  Prisma,
  ShiftApplicationStatus,
  ShiftPostingStatus,
  UserRole,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { availabilityService } from './availability';

function badRequest(message: string, code?: string): never {
  const e: any = new Error(message);
  e.status = 400;
  if (code) e.code = code;
  throw e;
}

function notFound(message: string): never {
  const e: any = new Error(message);
  e.status = 404;
  throw e;
}

const staffPostingInclude = {
  client: { select: { id: true, name: true, address: true } },
  applications: {
    include: {
      carer: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ShiftPostingInclude;

const shiftPostingsService = {
  async createPosting(
    organizationId: string,
    createdById: string | undefined,
    data: {
      clientId: string;
      slotsNeeded: number;
      startTime: string;
      endTime: string;
      title?: string | null;
    }
  ) {
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime >= endTime) {
      badRequest('Invalid start or end time');
    }
    if (!Number.isInteger(data.slotsNeeded) || data.slotsNeeded < 1) {
      badRequest('slotsNeeded must be a positive integer');
    }

    const client = await prisma.client.findFirst({
      where: { id: data.clientId, organizationId, active: true },
      select: { id: true },
    });
    if (!client) badRequest('Client not found or not in your organisation');

    return prisma.shiftPosting.create({
      data: {
        organizationId,
        clientId: data.clientId,
        slotsNeeded: data.slotsNeeded,
        startTime,
        endTime,
        title: data.title ?? null,
        createdById: createdById ?? null,
        status: ShiftPostingStatus.OPEN,
      },
      include: staffPostingInclude,
    });
  },

  async listForStaff(
    organizationId: string,
    query: { status?: string; from?: string; to?: string }
  ) {
    const where: Prisma.ShiftPostingWhereInput = { organizationId };
    if (query.status && ['OPEN', 'FILLED', 'CANCELLED'].includes(query.status)) {
      where.status = query.status as ShiftPostingStatus;
    }
    if (query.from || query.to) {
      where.startTime = {};
      if (query.from) where.startTime.gte = new Date(query.from);
      if (query.to) where.startTime.lte = new Date(query.to);
    }
    return prisma.shiftPosting.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: staffPostingInclude,
    });
  },

  async getByIdForStaff(id: string, organizationId: string) {
    const posting = await prisma.shiftPosting.findFirst({
      where: { id, organizationId },
      include: staffPostingInclude,
    });
    if (!posting) notFound('Shift posting not found');
    return posting;
  },

  async listAvailableForCarer(organizationId: string, carerId: string) {
    const now = new Date();
    const postings = await prisma.shiftPosting.findMany({
      where: {
        organizationId,
        status: ShiftPostingStatus.OPEN,
        endTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
      include: {
        client: { select: { id: true, name: true, address: true } },
        applications: { select: { id: true, status: true, carerId: true } },
      },
    });

    return postings.map((p) => {
      const selectedCount = p.applications.filter((a) => a.status === ShiftApplicationStatus.SELECTED).length;
      const pendingCount = p.applications.filter((a) => a.status === ShiftApplicationStatus.PENDING).length;
      const mine = p.applications.find((a) => a.carerId === carerId);
      const { applications, ...rest } = p;
      return {
        ...rest,
        selectedCount,
        pendingCount,
        applicantCount: applications.length,
        myApplicationStatus: mine?.status ?? null,
        myApplicationId: mine?.id ?? null,
      };
    });
  },

  async apply(carerId: string, shiftPostingId: string) {
    const user = await prisma.user.findFirst({
      where: { id: carerId, role: UserRole.CARER, isActive: true },
      select: { organizationId: true },
    });
    if (!user?.organizationId) badRequest('Carer not found');
    const organizationId = user.organizationId;

    const posting = await prisma.shiftPosting.findFirst({
      where: {
        id: shiftPostingId,
        organizationId,
        status: ShiftPostingStatus.OPEN,
      },
    });
    if (!posting) badRequest('This shift is not open for applications');

    if (posting.endTime <= new Date()) {
      badRequest('This shift has already ended');
    }

    const existing = await prisma.shiftApplication.findUnique({
      where: { shiftPostingId_carerId: { shiftPostingId, carerId } },
    });

    if (existing) {
      if (existing.status === ShiftApplicationStatus.PENDING) {
        badRequest('You have already applied for this shift', 'ALREADY_APPLIED');
      }
      if (existing.status === ShiftApplicationStatus.SELECTED) {
        badRequest('You are already assigned to this shift', 'ALREADY_ASSIGNED');
      }
      if (existing.status === ShiftApplicationStatus.NOT_SELECTED) {
        badRequest('You cannot re-apply for this shift');
      }
      if (existing.status === ShiftApplicationStatus.WITHDRAWN) {
        return prisma.shiftApplication.update({
          where: { id: existing.id },
          data: { status: ShiftApplicationStatus.PENDING },
          include: {
            shiftPosting: { include: { client: { select: { id: true, name: true } } } },
            carer: { select: { id: true, name: true } },
          },
        });
      }
    }

    return prisma.shiftApplication.create({
      data: { shiftPostingId, carerId, status: ShiftApplicationStatus.PENDING },
      include: {
        shiftPosting: { include: { client: { select: { id: true, name: true } } } },
        carer: { select: { id: true, name: true } },
      },
    });
  },

  async withdrawApplication(carerId: string, applicationId: string) {
    const app = await prisma.shiftApplication.findFirst({
      where: { id: applicationId, carerId },
      include: { shiftPosting: true },
    });
    if (!app) notFound('Application not found');
    if (app.status !== ShiftApplicationStatus.PENDING) {
      badRequest('Only pending applications can be withdrawn');
    }
    if (app.shiftPosting.status !== ShiftPostingStatus.OPEN) {
      badRequest('This shift is no longer accepting changes');
    }
    return prisma.shiftApplication.update({
      where: { id: applicationId },
      data: { status: ShiftApplicationStatus.WITHDRAWN },
    });
  },

  async cancelPosting(id: string, organizationId: string) {
    const posting = await prisma.shiftPosting.findFirst({
      where: { id, organizationId, status: ShiftPostingStatus.OPEN },
    });
    if (!posting) notFound('Open shift posting not found');

    await prisma.$transaction([
      prisma.shiftApplication.updateMany({
        where: {
          shiftPostingId: id,
          status: ShiftApplicationStatus.PENDING,
        },
        data: { status: ShiftApplicationStatus.NOT_SELECTED },
      }),
      prisma.shiftPosting.update({
        where: { id },
        data: { status: ShiftPostingStatus.CANCELLED },
      }),
    ]);

    return shiftPostingsService.getByIdForStaff(id, organizationId);
  },

  async selectApplicants(
    organizationId: string,
    shiftPostingId: string,
    applicationIds: string[]
  ) {
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      badRequest('applicationIds must be a non-empty array');
    }

    const posting = await prisma.shiftPosting.findFirst({
      where: { id: shiftPostingId, organizationId },
      include: {
        applications: true,
      },
    });
    if (!posting) notFound('Shift posting not found');
    if (posting.status !== ShiftPostingStatus.OPEN) {
      badRequest('Only open shift postings can be assigned');
    }

    const alreadySelected = posting.applications.filter(
      (a) => a.status === ShiftApplicationStatus.SELECTED
    ).length;
    const remainingSlots = posting.slotsNeeded - alreadySelected;
    if (remainingSlots <= 0) {
      badRequest('All slots for this shift are already filled');
    }
    if (applicationIds.length > remainingSlots) {
      badRequest(`You can select at most ${remainingSlots} more carer(s) for this shift`);
    }

    const toAssign = posting.applications.filter(
      (a) => applicationIds.includes(a.id) && a.status === ShiftApplicationStatus.PENDING
    );
    if (toAssign.length !== applicationIds.length) {
      badRequest('Some applications were not found or are not pending');
    }

    const carerIds = [...new Set(toAssign.map((a) => a.carerId))];
    const carers = await prisma.user.findMany({
      where: {
        id: { in: carerIds },
        organizationId,
        role: UserRole.CARER,
        isActive: true,
      },
      select: { id: true },
    });
    if (carers.length !== carerIds.length) {
      badRequest('All applicants must be active carers in your organisation');
    }

    for (const a of toAssign) {
      await availabilityService.assertCanBookSchedule(a.carerId, posting.startTime, posting.endTime);
    }

    const newSelectedTotal = alreadySelected + toAssign.length;
    const becomesFilled = newSelectedTotal >= posting.slotsNeeded;

    await prisma.$transaction(async (tx) => {
      for (const app of toAssign) {
        await tx.shiftApplication.update({
          where: { id: app.id },
          data: { status: ShiftApplicationStatus.SELECTED },
        });
        await tx.schedule.create({
          data: {
            clientId: posting.clientId,
            carerId: app.carerId,
            startTime: posting.startTime,
            endTime: posting.endTime,
          },
        });
        await tx.visit.create({
          data: {
            clientId: posting.clientId,
            carerId: app.carerId,
            scheduledStart: posting.startTime,
            scheduledEnd: posting.endTime,
            status: 'NOT_STARTED',
          },
        });
      }

      if (becomesFilled) {
        await tx.shiftApplication.updateMany({
          where: {
            shiftPostingId,
            status: ShiftApplicationStatus.PENDING,
          },
          data: { status: ShiftApplicationStatus.NOT_SELECTED },
        });
        await tx.shiftPosting.update({
          where: { id: shiftPostingId },
          data: { status: ShiftPostingStatus.FILLED },
        });
      }
    });

    return shiftPostingsService.getByIdForStaff(shiftPostingId, organizationId);
  },
};

export { shiftPostingsService };
