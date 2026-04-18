import express from 'express';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth';
import { emarService } from '../services/emarService';
import { getUserOrganizationId } from '../lib/organization';
import { medicationAlertService } from '../services/medicationAlertService';
import { medicationAlertDetectionService } from '../services/medicationAlertDetectionService';

const router = express.Router();

router.use(authenticate);
router.use(requireRole('ADMIN'));

router.get('/alerts', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }
    const includeAcknowledged = req.query.includeAcknowledged === '1';
    const alerts = await medicationAlertService.listForOrganization(organizationId, {
      includeAcknowledged,
      limit: req.query.limit ? Math.min(Number(req.query.limit) || 200, 500) : 200,
    });
    res.json({ alerts });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.patch('/alerts/:alertId/acknowledge', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }
    const updated = await medicationAlertService.acknowledge(organizationId, req.params.alertId, req.userId!);
    if (!updated) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Alert not found' });
    }
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/alerts/run-detection', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }
    await medicationAlertDetectionService.runForOrganization(organizationId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/exceptions', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    }

    const data = await emarService.getExceptions(organizationId, {
      clientId: (req.query.clientId as string) || undefined,
      from: (req.query.from as string) || undefined,
      to: (req.query.to as string) || undefined,
    });

    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

export default router;
