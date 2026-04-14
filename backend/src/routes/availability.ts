import express from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest, isCarerScopedRole } from '../middleware/auth';
import { availabilityService } from '../services/availability';

const router = express.Router();

const createAvailabilitySchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isAvailable: z.boolean().default(true),
});

const updateAvailabilitySchema = createAvailabilitySchema.partial();

// Get availability - carers can see their own, admins/managers can see any carer's
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { carerId, startDate, endDate } = req.query;
    
    let targetCarerId = req.userId!;
    
    // Admins and managers can view any carer's availability
    if ((req.userRole === 'ADMIN' || req.userRole === 'MANAGER') && carerId) {
      targetCarerId = carerId as string;
    }
    // Carers can only view their own availability
    else if (isCarerScopedRole(req.userRole) && carerId && carerId !== req.userId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to view this availability' });
    }

    const availability = await availabilityService.getAvailability(
      targetCarerId,
      startDate as string,
      endDate as string
    );

    res.json(availability);
  } catch (error: any) {
    console.error('Get availability error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Check if carer is available for a time period (for admins/managers)
router.get('/check', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const { carerId, startTime, endTime } = req.query;

    if (!carerId || !startTime || !endTime) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'carerId, startTime, and endTime are required' });
    }

    const result = await availabilityService.evaluateScheduleWindow(
      carerId as string,
      new Date(startTime as string),
      new Date(endTime as string)
    );

    res.json({
      canSchedule: result.ok,
      isAvailable: result.ok,
      message: result.ok ? undefined : result.message,
      code: result.ok ? undefined : result.code,
    });
  } catch (error: any) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Create availability (carers can create their own, admins/managers can create for any carer)
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = createAvailabilitySchema.parse(req.body);
    const { carerId } = req.body;

    let targetCarerId = req.userId!;
    
    // Admins and managers can create availability for any carer
    if ((req.userRole === 'ADMIN' || req.userRole === 'MANAGER') && carerId) {
      targetCarerId = carerId;
    }
    // Carers can only create their own availability
    else if (isCarerScopedRole(req.userRole) && carerId && carerId !== req.userId) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Not authorized to create availability for this carer' });
    }

    const availability = await availabilityService.createAvailability(targetCarerId, {
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      isAvailable: data.isAvailable,
    });

    res.status(201).json(availability);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid input', details: error.errors });
    }
    console.error('Create availability error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Update availability (carers can update their own, admins/managers can update any carer's)
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const data = updateAvailabilitySchema.parse(req.body);
    const { id } = req.params;

    const updateData: any = {};
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);
    if (data.isAvailable !== undefined) updateData.isAvailable = data.isAvailable;

    // Admins and managers can update any carer's availability
    const isAdmin = req.userRole === 'ADMIN' || req.userRole === 'MANAGER';
    const availability = await availabilityService.updateAvailability(id, req.userId!, updateData, isAdmin);

    res.json(availability);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Invalid input', details: error.errors });
    }
    if (error.status === 403 || error.status === 404) {
      return res.status(error.status).json({ error: error.status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message: error.message });
    }
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

// Delete availability (carers can delete their own, admins/managers can delete any carer's)
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Admins and managers can delete any carer's availability
    const isAdmin = req.userRole === 'ADMIN' || req.userRole === 'MANAGER';
    await availabilityService.deleteAvailability(id, req.userId!, isAdmin);

    res.json({ message: 'Availability deleted' });
  } catch (error: any) {
    if (error.status === 403 || error.status === 404) {
      return res.status(error.status).json({ error: error.status === 403 ? 'FORBIDDEN' : 'NOT_FOUND', message: error.message });
    }
    console.error('Delete availability error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message });
  }
});

export default router;

