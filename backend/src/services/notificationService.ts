import { IncidentSeverity, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { sendExpoPushMessages } from '../lib/expoPush';
import { escapeHtml, sendTransactionalEmail, webAppBaseUrl } from '../lib/transactionalEmail';

async function resolveOpsAlertSenderId(organizationId: string): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { organizationId, role: UserRole.ADMIN, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (admin) return admin.id;
  const manager = await prisma.user.findFirst({
    where: { organizationId, role: UserRole.MANAGER, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return manager?.id ?? null;
}

export const notificationService = {
  async sendManagerToCarerMessage(input: {
    organizationId: string;
    managerId: string;
    carerId: string;
    body: string;
    subject?: string;
  }) {
    return prisma.messageThread.create({
      data: {
        organizationId: input.organizationId,
        subject: input.subject || null,
        createdById: input.managerId,
        isBroadcast: false,
        messages: {
          create: {
            senderId: input.managerId,
            recipientId: input.carerId,
            body: input.body,
          },
        },
      },
      include: { messages: true },
    });
  },

  async sendBroadcastAlert(input: {
    organizationId: string;
    senderId: string;
    body: string;
    subject?: string;
  }) {
    const carers = await prisma.user.findMany({
      where: { organizationId: input.organizationId, role: 'CARER', isActive: true },
      select: { id: true },
    });

    return prisma.messageThread.create({
      data: {
        organizationId: input.organizationId,
        subject: input.subject || null,
        createdById: input.senderId,
        isBroadcast: true,
        messages: {
          create: carers.map((carer) => ({
            senderId: input.senderId,
            recipientId: carer.id,
            body: input.body,
          })),
        },
      },
      include: { messages: true },
    });
  },

  async getInbox(userId: string, organizationId: string) {
    return prisma.message.findMany({
      where: {
        recipientId: userId,
        thread: { organizationId },
      },
      include: {
        thread: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  },

  /** In-app messages to active admins and managers (eMAR / stock / compliance alerts). */
  /** Email (Resend), Expo push, and in-app message for linked family accounts when a visit completes. */
  async notifyGuardiansVisitCompleted(input: {
    organizationId: string;
    visit: {
      id: string;
      clientId: string;
      clientName: string;
      carerId: string;
      carerName: string;
      clockInTime: Date;
      clockOutTime: Date;
      scheduledStart: Date | null;
      scheduledEnd: Date | null;
    };
  }) {
    const links = await prisma.guardianLink.findMany({
      where: {
        organizationId: input.organizationId,
        clientId: input.visit.clientId,
        active: true,
        canViewVisits: true,
      },
      include: {
        guardianUser: {
          select: { id: true, name: true, email: true, emailVerifiedAt: true, expoPushToken: true },
        },
      },
    });
    if (links.length === 0) return;

    const durationMin = Math.max(
      1,
      Math.round((input.visit.clockOutTime.getTime() - input.visit.clockInTime.getTime()) / 60000)
    );
    const subject = `Visit completed: ${input.visit.clientName}`;
    const body =
      `${input.visit.clientName} has a completed care visit.\n\n` +
      `Carer: ${input.visit.carerName}\n` +
      `Visit ended: ${input.visit.clockOutTime.toLocaleString()}\n` +
      `Approx. duration: ${durationMin} minutes\n\n` +
      `Open Family feed in Haven Check to see notes and other updates.`;

    await prisma.messageThread.create({
      data: {
        organizationId: input.organizationId,
        subject,
        createdById: input.visit.carerId,
        isBroadcast: false,
        messages: {
          create: links.map((l) => ({
            senderId: input.visit.carerId,
            recipientId: l.guardianUserId,
            body,
          })),
        },
      },
    });

    const feedUrl = `${webAppBaseUrl()}/guardian`;
    for (const link of links) {
      const u = link.guardianUser;
      if (u.emailVerifiedAt) {
        const first = u.name.trim().split(/\s+/)[0] || u.name;
        const html =
          `<p>Hi ${escapeHtml(first)},</p>` +
          `<p>${escapeHtml(body).replace(/\n/g, '<br/>')}</p>` +
          `<p><a href="${feedUrl}">Open Family feed</a></p>`;
        void sendTransactionalEmail({ to: u.email, subject, html }).catch((e) =>
          console.warn('[guardian-email] visit', u.id, e)
        );
      }
    }

    const pushPayload = links
      .filter((l) => l.guardianUser.expoPushToken)
      .map((l) => ({
        to: l.guardianUser.expoPushToken!,
        title: subject,
        body: `${input.visit.carerName} finished a ${durationMin} min visit.`,
        data: { kind: 'visit_completed', visitId: input.visit.id, clientId: input.visit.clientId },
      }));
    void sendExpoPushMessages(pushPayload);
  },

  /** Email, push, and in-app message when staff logs an incident for a linked client. */
  async notifyGuardiansIncidentReported(input: {
    organizationId: string;
    incident: {
      id: string;
      clientId: string;
      clientName: string;
      category: string;
      severity: IncidentSeverity;
      reportedById: string;
      reporterName: string;
      details: string | null;
    };
  }) {
    const links = await prisma.guardianLink.findMany({
      where: {
        organizationId: input.organizationId,
        clientId: input.incident.clientId,
        active: true,
        canViewIncidents: true,
      },
      include: {
        guardianUser: {
          select: { id: true, name: true, email: true, emailVerifiedAt: true, expoPushToken: true },
        },
      },
    });
    if (links.length === 0) return;

    const maxDetail = 240;
    const detail = (input.incident.details || '').trim();
    const detailLine = detail.length > maxDetail ? `${detail.slice(0, maxDetail)}…` : detail;

    const subject = `Incident reported: ${input.incident.clientName}`;
    const body =
      `An incident has been logged for ${input.incident.clientName}.\n\n` +
      `Category: ${input.incident.category}\n` +
      `Severity: ${input.incident.severity}\n` +
      `Reported by: ${input.incident.reporterName}\n` +
      (detailLine ? `Summary: ${detailLine}\n\n` : '\n') +
      `Please open Haven Check for the latest status.`;

    await prisma.messageThread.create({
      data: {
        organizationId: input.organizationId,
        subject,
        createdById: input.incident.reportedById,
        isBroadcast: false,
        messages: {
          create: links.map((l) => ({
            senderId: input.incident.reportedById,
            recipientId: l.guardianUserId,
            body,
          })),
        },
      },
    });

    const feedUrl = `${webAppBaseUrl()}/guardian`;
    for (const link of links) {
      const u = link.guardianUser;
      if (u.emailVerifiedAt) {
        const first = u.name.trim().split(/\s+/)[0] || u.name;
        const html =
          `<p>Hi ${escapeHtml(first)},</p>` +
          `<p>${escapeHtml(body).replace(/\n/g, '<br/>')}</p>` +
          `<p><a href="${feedUrl}">Open Family feed</a></p>`;
        void sendTransactionalEmail({ to: u.email, subject, html }).catch((e) =>
          console.warn('[guardian-email] incident', u.id, e)
        );
      }
    }

    const pushPayload = links
      .filter((l) => l.guardianUser.expoPushToken)
      .map((l) => ({
        to: l.guardianUser.expoPushToken!,
        title: subject,
        body: `${input.incident.category} · ${input.incident.severity}`,
        data: { kind: 'incident', incidentId: input.incident.id, clientId: input.incident.clientId },
      }));
    void sendExpoPushMessages(pushPayload);
  },

  async notifyMedicationAlert(input: { organizationId: string; title: string; body: string }) {
    const senderId = await resolveOpsAlertSenderId(input.organizationId);
    if (!senderId) return null;

    const recipients = await prisma.user.findMany({
      where: {
        organizationId: input.organizationId,
        role: { in: [UserRole.ADMIN, UserRole.MANAGER] },
        isActive: true,
      },
      select: { id: true },
    });
    if (recipients.length === 0) return null;

    return prisma.messageThread.create({
      data: {
        organizationId: input.organizationId,
        subject: input.title,
        createdById: senderId,
        isBroadcast: false,
        messages: {
          create: recipients.map((r) => ({
            senderId,
            recipientId: r.id,
            body: input.body,
          })),
        },
      },
      include: { messages: true },
    });
  },
};
