import express from 'express';
import { RiskTemplateType, UserRole } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { getUserOrganizationId } from '../lib/organization';
import { prisma } from '../lib/prisma';
import { computeRiskScore, riskLevelFromScore, type ScoringRule } from '../lib/riskScoring';

const router = express.Router();

const defaultRiskTemplates = [
  {
    templateType: RiskTemplateType.FALLS,
    name: 'Falls Risk Assessment',
    description: 'Assess mobility, balance, and prior falls.',
    scoringRules: [
      { key: 'historyOfFalls', label: 'History of falls', weight: 3 },
      { key: 'impairedBalance', label: 'Impaired balance', weight: 2 },
      { key: 'unsafeFootwear', label: 'Unsafe footwear', weight: 1 },
    ],
  },
  {
    templateType: RiskTemplateType.PRESSURE_SORES,
    name: 'Pressure Sores Risk Assessment',
    description: 'Assess pressure injury risk and skin integrity factors.',
    scoringRules: [
      { key: 'limitedMobility', label: 'Limited mobility', weight: 3 },
      { key: 'skinBreakdownHistory', label: 'Skin breakdown history', weight: 2 },
      { key: 'moistureExposure', label: 'Moisture exposure', weight: 1 },
    ],
  },
  {
    templateType: RiskTemplateType.NUTRITION,
    name: 'Nutrition Risk Assessment',
    description: 'Assess risk factors related to nutrition and hydration.',
    scoringRules: [
      { key: 'lowAppetite', label: 'Low appetite', weight: 2 },
      { key: 'weightLoss', label: 'Recent weight loss', weight: 3 },
      { key: 'dehydrationSigns', label: 'Dehydration signs', weight: 2 },
    ],
  },
] as const;

const createAssessmentSchema = z.object({
  clientId: z.string().trim().min(1),
  carePlanId: z.string().trim().optional(),
  templateId: z.string().trim().min(1),
  answers: z.record(z.number().int().min(0).max(3)),
  reviewedAt: z.string().datetime().optional(),
});
const scoringRuleSchema = z.array(
  z.object({
    key: z.string(),
    label: z.string(),
    weight: z.number(),
  })
);

router.use(authenticate);

async function requireOrg(req: AuthRequest, res: express.Response) {
  const organizationId = await getUserOrganizationId(req.userId!);
  if (!organizationId) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    return null;
  }
  return organizationId;
}

function parseScoringRules(raw: unknown): ScoringRule[] {
  const parsed = scoringRuleSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

function serializeAssessment(row: {
  answers: unknown;
  totalScore: number;
  riskLevel: string;
  scoreBreakdown: unknown;
  template: { scoringRules: unknown };
  [key: string]: unknown;
}) {
  const rules = parseScoringRules(row.template.scoringRules);
  const answers = (row.answers && typeof row.answers === 'object' ? row.answers : {}) as Record<string, number>;
  const stored = row.scoreBreakdown as { maxScore?: number; lines?: unknown[] } | null;
  const computed = computeRiskScore(rules, answers);
  const scoreBreakdown =
    stored && Array.isArray(stored.lines) && typeof stored.maxScore === 'number'
      ? { maxScore: stored.maxScore, lines: stored.lines }
      : { maxScore: computed.maxScore, lines: computed.breakdown };
  return { ...row, maxScore: scoreBreakdown.maxScore, scoreBreakdown };
}

router.get('/templates', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;

    const existingCount = await prisma.riskTemplate.count({ where: { organizationId } });
    if (existingCount === 0) {
      await prisma.riskTemplate.createMany({
        data: defaultRiskTemplates.map((template) => ({
          organizationId,
          templateType: template.templateType,
          name: template.name,
          description: template.description,
          scoringRules: template.scoringRules,
        })),
      });
    }

    const templates = await prisma.riskTemplate.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/client/:clientId', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const assessments = await prisma.riskAssessment.findMany({
      where: { organizationId, clientId: req.params.clientId },
      include: {
        template: true,
        carePlan: { select: { id: true, status: true, reviewDate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(assessments.map((row) => serializeAssessment(row as any)));
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/assessments', requireRole(UserRole.MANAGER, UserRole.ADMIN), async (req: AuthRequest, res) => {
  try {
    const organizationId = await requireOrg(req, res);
    if (!organizationId) return;
    const payload = createAssessmentSchema.parse(req.body);

    const [client, template] = await Promise.all([
      prisma.client.findFirst({ where: { id: payload.clientId, organizationId }, select: { id: true } }),
      prisma.riskTemplate.findFirst({ where: { id: payload.templateId, organizationId } }),
    ]);
    if (!client) return res.status(404).json({ error: 'NOT_FOUND', message: 'Client not found' });
    if (!template) return res.status(404).json({ error: 'NOT_FOUND', message: 'Template not found' });

    let carePlanId: string | null = null;
    if (payload.carePlanId) {
      const linkedPlan = await prisma.carePlan.findFirst({
        where: { id: payload.carePlanId, organizationId, clientId: payload.clientId },
        select: { id: true },
      });
      if (!linkedPlan) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid care plan link' });
      }
      carePlanId = linkedPlan.id;
    }

    const scoringRules = parseScoringRules(template.scoringRules);
    const { totalScore, maxScore, breakdown } = computeRiskScore(scoringRules, payload.answers);
    const scoreBreakdown = { maxScore, lines: breakdown };

    const created = await prisma.riskAssessment.create({
      data: {
        organizationId,
        clientId: payload.clientId,
        carePlanId,
        templateId: payload.templateId,
        answers: payload.answers,
        totalScore,
        riskLevel: riskLevelFromScore(totalScore),
        scoreBreakdown,
        reviewedAt: payload.reviewedAt ? new Date(payload.reviewedAt) : new Date(),
        createdById: req.userId!,
      },
      include: {
        template: true,
        carePlan: { select: { id: true, status: true, reviewDate: true } },
      },
    });

    res.status(201).json(serializeAssessment(created as any));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0]?.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

export default router;
