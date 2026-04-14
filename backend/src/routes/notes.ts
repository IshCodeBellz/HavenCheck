import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest, isCarerScopedRole } from '../middleware/auth';
import { NoteType, NotePriority } from '@prisma/client';
import { getUserOrganizationId } from '../lib/organization';

const router = express.Router();

const createNoteSchema = z.object({
  visitId: z.string(),
  type: z.nativeEnum(NoteType),
  priority: z.nativeEnum(NotePriority).default('NORMAL'),
  text: z.string().min(1),
});

// Get notes for a visit
router.get('/visits/:visitId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { visitId } = req.params;
    const { type } = req.query;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { client: { select: { organizationId: true } } },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Carers can only view notes for their own visits
    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const where: any = { visitId };
    if (type) {
      where.type = type as NoteType;
    }

    const notes = await prisma.note.findMany({
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
                organizationId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get handover notes for a visit
router.get('/visits/:visitId/handover', authenticate, async (req: AuthRequest, res) => {
  try {
    const { visitId } = req.params;

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { client: { select: { organizationId: true } } },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Carers can only view notes for their own visits
    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const notes = await prisma.note.findMany({
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
      take: 10, // Latest 10 handover notes
    });

    res.json(notes);
  } catch (error) {
    console.error('Get handover notes error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create note
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = createNoteSchema.parse(req.body);

    // Verify visit exists and user has access
    const visit = await prisma.visit.findUnique({
      where: { id: data.visitId },
      include: { client: { select: { organizationId: true } } },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Carers can only create notes for their own visits
    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const note = await prisma.note.create({
      data: {
        visitId: data.visitId,
        authorId: req.userId!,
        type: data.type,
        priority: data.priority,
        text: data.text,
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
                organizationId: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get note by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const note = await prisma.note.findUnique({
      where: { id: req.params.id },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        visit: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                organizationId: true,
              },
            },
          },
        },
      },
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId || note.visit.client.organizationId !== organizationId) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Carers can only view notes for their own visits
    if (isCarerScopedRole(req.userRole) && note.visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(note);
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

