import express from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { visitsService } from '../services/visits';
import { schedulesService } from '../services/schedules';
import { checklistsService } from '../services/checklists';
import { notesService } from '../services/notes';
import { availabilityService } from '../services/availability';
import { getUserOrganizationId } from '../lib/organization';
import { shiftPostingsService } from '../services/shiftPostings';

const router = express.Router();

// All routes require authentication and carer role
router.use(authenticate);
router.use(requireRole(UserRole.CARER, UserRole.GUARDIAN));

// Visits - carer's own visits
router.get('/visits/today', async (req: AuthRequest, res) => {
  try {
    const visits = await visitsService.getTodayVisits(req.userId!);
    res.json(visits);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/visits', async (req: AuthRequest, res) => {
  try {
    const visits = await visitsService.getVisits(req.userId!, req.query);
    res.json(visits);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/visits/:id', async (req: AuthRequest, res) => {
  try {
    const visit = await visitsService.getVisitById(req.params.id, req.userId!);
    res.json(visit);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/visits/:id/clock-in', async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== UserRole.CARER) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only carers can clock in' });
    }
    const visit = await visitsService.clockIn(req.params.id, req.userId!, req.body);
    res.json(visit);
  } catch (error: any) {
    if (error.status === 403 || error.status === 400) {
      return res.status(error.status).json({ error: error.error || 'BAD_REQUEST', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/visits/:id/clock-out', async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== UserRole.CARER) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only carers can clock out' });
    }
    const visit = await visitsService.clockOut(req.params.id, req.userId!, req.body);
    res.json(visit);
  } catch (error: any) {
    if (error.status === 403 || error.status === 400) {
      return res.status(error.status).json({ error: error.error || 'BAD_REQUEST', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Schedules - carer's own schedules
router.get('/schedules/weekly', async (req: AuthRequest, res) => {
  try {
    const rota = await schedulesService.getWeeklyRota(req.userId!, req.query.weekStart as string);
    res.json(rota);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/schedules', async (req: AuthRequest, res) => {
  try {
    const schedules = await schedulesService.getSchedules(req.userId!, req.query);
    res.json(schedules);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Open shifts (apply); only carers may apply — not guardians
router.get('/open-shifts', async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const items = await shiftPostingsService.listAvailableForCarer(organizationId, req.userId!);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/open-shifts/applications/:applicationId/withdraw', async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== UserRole.CARER) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only carers can withdraw applications' });
    }
    const updated = await shiftPostingsService.withdrawApplication(req.userId!, req.params.applicationId);
    res.json(updated);
  } catch (error: any) {
    if (error.status === 404) {
      return res.status(404).json({ error: 'NOT_FOUND', message: error.message });
    }
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/open-shifts/:shiftPostingId/apply', async (req: AuthRequest, res) => {
  try {
    if (req.userRole !== UserRole.CARER) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only carers can apply for shifts' });
    }
    const created = await shiftPostingsService.apply(req.userId!, req.params.shiftPostingId);
    res.status(201).json(created);
  } catch (error: any) {
    if (error.status === 400) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message, code: error.code });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Checklists
router.get('/checklists/templates', async (req: AuthRequest, res) => {
  try {
    const templates = await checklistsService.getTemplates(req.query.clientId as string);
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/checklists/visits/:visitId/submit', async (req: AuthRequest, res) => {
  try {
    const submission = await checklistsService.submitChecklist(
      req.params.visitId,
      req.userId!,
      req.body
    );
    res.status(201).json(submission);
  } catch (error: any) {
    if (error.status === 403 || error.status === 400) {
      return res.status(error.status).json({ error: error.error || 'BAD_REQUEST', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/checklists/visits/:visitId/submissions', async (req: AuthRequest, res) => {
  try {
    const submissions = await checklistsService.getSubmissions(req.params.visitId, req.userId!);
    res.json(submissions);
  } catch (error: any) {
    if (error.status === 403) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Notes
router.get('/notes/visits/:visitId', async (req: AuthRequest, res) => {
  try {
    const notes = await notesService.getNotes(req.params.visitId, req.userId!, req.query.type as string);
    res.json(notes);
  } catch (error: any) {
    if (error.status === 403) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.get('/notes/visits/:visitId/handover', async (req: AuthRequest, res) => {
  try {
    const notes = await notesService.getHandoverNotes(req.params.visitId, req.userId!);
    res.json(notes);
  } catch (error: any) {
    if (error.status === 403) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/notes', async (req: AuthRequest, res) => {
  try {
    const note = await notesService.createNote(req.userId!, req.body);
    res.status(201).json(note);
  } catch (error: any) {
    if (error.status === 400 || error.status === 403) {
      return res.status(error.status).json({ error: error.error || 'BAD_REQUEST', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Availability - carers can manage their own availability
router.get('/availability', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate } = req.query;
    const availability = await availabilityService.getAvailability(
      req.userId!,
      startDate as string,
      endDate as string
    );
    res.json(availability);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.post('/availability', async (req: AuthRequest, res) => {
  try {
    const { startTime, endTime, isAvailable } = req.body;
    const availability = await availabilityService.createAvailability(req.userId!, {
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      isAvailable: isAvailable !== undefined ? isAvailable : true,
    });
    res.status(201).json(availability);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.put('/availability/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, isAvailable } = req.body;
    const updateData: any = {};
    if (startTime) updateData.startTime = new Date(startTime);
    if (endTime) updateData.endTime = new Date(endTime);
    if (isAvailable !== undefined) updateData.isAvailable = isAvailable;
    
    const availability = await availabilityService.updateAvailability(id, req.userId!, updateData);
    res.json(availability);
  } catch (error: any) {
    if (error.status === 403 || error.status === 404) {
      return res.status(error.status).json({ error: error.status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

router.delete('/availability/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await availabilityService.deleteAvailability(id, req.userId!);
    res.json({ message: 'Availability deleted' });
  } catch (error: any) {
    if (error.status === 403 || error.status === 404) {
      return res.status(error.status).json({ error: error.status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message: error.message });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

export default router;
