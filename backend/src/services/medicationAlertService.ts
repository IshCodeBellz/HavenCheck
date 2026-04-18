import { MedicationAlertType, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notificationService } from './notificationService';

export type CreateMedicationAlertInput = {
  organizationId: string;
  type: MedicationAlertType;
  medicationId: string;
  clientId: string;
  visitId?: string | null;
  scheduleId?: string | null;
  dedupeKey: string;
  title: string;
  detail?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export const medicationAlertService = {
  async tryCreateAndNotify(input: CreateMedicationAlertInput) {
    try {
      const alert = await prisma.medicationAlert.create({
        data: {
          organizationId: input.organizationId,
          type: input.type,
          medicationId: input.medicationId,
          clientId: input.clientId,
          visitId: input.visitId ?? null,
          scheduleId: input.scheduleId ?? null,
          dedupeKey: input.dedupeKey,
          title: input.title,
          detail: input.detail ?? null,
          ...(input.metadata !== undefined ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
        },
        include: {
          client: { select: { name: true } },
          medication: { select: { name: true } },
        },
      });

      await notificationService.notifyMedicationAlert({
        organizationId: alert.organizationId,
        title: alert.title,
        body: [alert.detail, `Client: ${alert.client.name}`, `Medication: ${alert.medication.name}`].filter(Boolean).join('\n'),
      });

      await prisma.medicationAlert.update({
        where: { id: alert.id },
        data: { notifiedAt: new Date() },
      });

      return alert;
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'P2002') return null;
      throw e;
    }
  },

  async listForOrganization(
    organizationId: string,
    filters: { includeAcknowledged?: boolean; limit?: number } = {}
  ) {
    const limit = filters.limit ?? 200;
    const where: Prisma.MedicationAlertWhereInput = { organizationId };
    if (!filters.includeAcknowledged) {
      where.acknowledgedAt = null;
    }
    return prisma.medicationAlert.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        medication: { select: { id: true, name: true, isPrn: true } },
        visit: { select: { id: true, scheduledStart: true, clockInTime: true } },
        schedule: { select: { id: true, timeOfDay: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async acknowledge(organizationId: string, alertId: string, userId: string) {
    const alert = await prisma.medicationAlert.findFirst({
      where: { id: alertId, organizationId },
    });
    if (!alert) return null;
    if (alert.acknowledgedAt) return alert;
    return prisma.medicationAlert.update({
      where: { id: alertId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: userId,
      },
    });
  },
};
