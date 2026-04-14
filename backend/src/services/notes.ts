import { prisma } from '../lib/prisma';
import { NoteType, NotePriority } from '@prisma/client';
import { z } from 'zod';

const createNoteSchema = z.object({
  visitId: z.string(),
  type: z.nativeEnum(NoteType),
  priority: z.nativeEnum(NotePriority).default('NORMAL'),
  text: z.string().min(1),
});

export const notesService = {
  async getNotes(visitId: string, carerId: string | undefined, type?: string) {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      const error: any = new Error('Visit not found');
      error.status = 404;
      throw error;
    }

    if (carerId && visit.carerId !== carerId) {
      const error: any = new Error('Not authorized to view notes for this visit');
      error.status = 403;
      throw error;
    }

    const where: any = { visitId };
    if (type) {
      where.type = type as NoteType;
    }

    return await prisma.note.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        visit: {
          select: {
            id: true,
            client: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async getHandoverNotes(visitId: string, carerId: string | undefined) {
    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
    });

    if (!visit) {
      const error: any = new Error('Visit not found');
      error.status = 404;
      throw error;
    }

    if (carerId && visit.carerId !== carerId) {
      const error: any = new Error('Not authorized to view handover notes for this visit');
      error.status = 403;
      throw error;
    }

    return await prisma.note.findMany({
      where: {
        visitId,
        type: 'HANDOVER',
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  },

  async createNote(authorId: string, data: any) {
    try {
      const validated = createNoteSchema.parse(data);

      const visit = await prisma.visit.findUnique({
        where: { id: validated.visitId },
      });

      if (!visit) {
        const error: any = new Error('Visit not found');
        error.status = 404;
        throw error;
      }

      return await prisma.note.create({
        data: {
          visitId: validated.visitId,
          authorId,
          type: validated.type,
          priority: validated.priority,
          text: validated.text,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          visit: {
            select: {
              id: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
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
};

