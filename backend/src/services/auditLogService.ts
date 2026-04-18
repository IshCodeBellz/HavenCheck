import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma';

type AuditLogInput = {
  organizationId: string;
  module: string;
  action: string;
  entityType?: string;
  entityId?: string;
  actorId: string;
  actorRole?: UserRole;
  route?: string;
  method?: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
};

export const auditLogService = {
  async log(input: AuditLogInput) {
    return prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        module: input.module,
        action: input.action,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        actorId: input.actorId,
        actorRole: input.actorRole || null,
        route: input.route || null,
        method: input.method || null,
        beforeData: (input.beforeData as any) ?? null,
        afterData: (input.afterData as any) ?? null,
        metadata: (input.metadata as any) ?? null,
      },
    });
  },
};
