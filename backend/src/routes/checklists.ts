import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest, isCarerScopedRole } from '../middleware/auth';
import { ChecklistFieldType } from '@prisma/client';
import { getUserOrganizationId } from '../lib/organization';

const router = express.Router();

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

// Get all templates
router.get('/templates', authenticate, async (req, res) => {
  try {
    const organizationId = await getUserOrganizationId((req as AuthRequest).userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const { clientId } = req.query;

    const where: any = { organizationId };
    if (clientId) {
      // Include templates for this client OR general templates (where clientId is null)
      where.OR = [
        { clientId: clientId as string },
        { clientId: null },
      ];
    }

    const templates = await prisma.checklistTemplate.findMany({
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

    // Prioritize client-specific templates over general templates (null clientId)
    if (clientId) {
      templates.sort((a, b) => {
        // Client-specific templates first (non-null clientId)
        if (a.clientId === clientId && b.clientId !== clientId) return -1;
        if (a.clientId !== clientId && b.clientId === clientId) return 1;
        return 0; // Keep original order for same type
      });
    }

    res.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get template by ID
router.get('/templates/:id', authenticate, async (req, res) => {
  try {
    const organizationId = await getUserOrganizationId((req as AuthRequest).userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const template = await prisma.checklistTemplate.findFirst({
      where: { id: req.params.id, organizationId },
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
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create template (Admin/Manager only)
router.post('/templates', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const organizationId = await getUserOrganizationId((req as AuthRequest).userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const data = createTemplateSchema.parse(req.body);
    if (data.clientId) {
      const client = await prisma.client.findFirst({
        where: { id: data.clientId, organizationId },
        select: { id: true },
      });
      if (!client) return res.status(400).json({ error: 'Client must belong to your organization' });
    }

    const template = await prisma.checklistTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        organizationId,
        clientId: data.clientId,
        items: {
          create: data.items,
        },
      },
      include: {
        items: true,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit checklist for a visit
router.post('/visits/:visitId/submit', authenticate, async (req: AuthRequest, res) => {
  try {
    const { visitId } = req.params;
    const data = createSubmissionSchema.parse(req.body);

    // Verify visit exists and user has access
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

    // Carers can only submit for their own visits
    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const submission = await prisma.visitChecklistSubmission.create({
      data: {
        visitId,
        templateId: data.templateId,
        intervalIndex: data.intervalIndex,
        items: {
          create: data.items,
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

    res.status(201).json(submission);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Submit checklist error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get submissions for a visit
router.get('/visits/:visitId/submissions', authenticate, async (req: AuthRequest, res) => {
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

    // Carers can only view their own visits
    if (isCarerScopedRole(req.userRole) && visit.carerId !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const submissions = await prisma.visitChecklistSubmission.findMany({
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

    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

