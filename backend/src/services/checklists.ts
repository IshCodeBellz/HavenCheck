import { prisma } from '../lib/prisma';
import { ChecklistFieldType } from '@prisma/client';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().optional(),
  items: z.array(
    z.object({
      label: z.string().min(1),
      type: z.nativeEnum(ChecklistFieldType),
      required: z.boolean().default(false),
      optionsJson: z.string().optional(),
    })
  ),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().optional().nullable(),
  items: z.array(
    z.object({
      label: z.string().min(1),
      type: z.nativeEnum(ChecklistFieldType),
      required: z.boolean().default(false),
      optionsJson: z.string().optional(),
    })
  ),
});

const createSubmissionSchema = z.object({
  templateId: z.string(),
  intervalIndex: z.number().int().optional(),
  items: z.array(
    z.object({
      checklistItemId: z.string().optional(),
      valueBoolean: z.boolean().optional(),
      valueText: z.string().optional(),
      valueNumber: z.number().optional(),
      valueOption: z.string().optional(),
    })
  ),
});

export const checklistsService = {
  async getTemplates(clientId?: string) {
    const where: any = {};
    if (clientId) {
      where.clientId = clientId;
    }

    return await prisma.checklistTemplate.findMany({
      where,
      include: {
        items: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async createTemplate(data: any) {
    try {
      const validated = createTemplateSchema.parse(data);
      if (!data.organizationId) {
        const err: any = new Error('organizationId is required');
        err.status = 400;
        throw err;
      }

      return await prisma.checklistTemplate.create({
        data: {
          name: validated.name,
          description: validated.description,
          organizationId: data.organizationId,
          clientId: validated.clientId,
          items: {
            create: validated.items,
          },
        },
        include: {
          items: true,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const err: any = new Error(error.errors[0].message);
        err.status = 400;
        throw err;
      }
      throw error;
    }
  },

  async getTemplateById(id: string) {
    const template = await prisma.checklistTemplate.findUnique({
      where: { id },
      include: {
        items: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!template) {
      const error: any = new Error('Checklist template not found');
      error.status = 404;
      throw error;
    }

    return template;
  },

  async updateTemplate(id: string, data: any) {
    try {
      const validated = updateTemplateSchema.parse(data);

      const existing = await prisma.checklistTemplate.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        const error: any = new Error('Checklist template not found');
        error.status = 404;
        throw error;
      }

      return await prisma.$transaction(async (tx) => {
        await tx.checklistItem.deleteMany({
          where: { templateId: id },
        });

        return await tx.checklistTemplate.update({
          where: { id },
          data: {
            name: validated.name,
            description: validated.description,
            clientId: validated.clientId || null,
            items: {
              create: validated.items,
            },
          },
          include: {
            items: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const err: any = new Error(error.errors[0].message);
        err.status = 400;
        throw err;
      }
      throw error;
    }
  },

  async submitChecklist(visitId: string, carerId: string, data: any) {
    try {
      const validated = createSubmissionSchema.parse(data);

      const visit = await prisma.visit.findUnique({
        where: { id: visitId },
      });

      if (!visit) {
        const error: any = new Error('Visit not found');
        error.status = 404;
        throw error;
      }

      if (visit.carerId !== carerId) {
        const error: any = new Error('Not authorized to submit checklist for this visit');
        error.status = 403;
        error.error = 'FORBIDDEN';
        throw error;
      }

      return await prisma.visitChecklistSubmission.create({
        data: {
          visitId,
          templateId: validated.templateId,
          intervalIndex: validated.intervalIndex,
          items: {
            create: validated.items,
          },
        },
        include: {
          items: true,
          template: {
            include: {
              items: true,
            },
          },
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const err: any = new Error(error.errors[0].message);
        err.status = 400;
        throw err;
      }
      throw error;
    }
  },

  async getSubmissions(visitId: string, carerId: string) {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      const error: any = new Error('Visit not found');
      error.status = 404;
      throw error;
    }

    if (visit.carerId !== carerId) {
      const error: any = new Error('Not authorized to view submissions for this visit');
      error.status = 403;
      throw error;
    }

    return await prisma.visitChecklistSubmission.findMany({
      where: { visitId },
      include: {
        template: {
          include: {
            items: true,
          },
        },
        items: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
  },
};

