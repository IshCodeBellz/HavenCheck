import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import { getUserOrganizationId } from '../lib/organization';
import { usersService } from '../services/users';

const router = express.Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole),
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

// Get all users (Admin/Manager only)
router.get('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const organizationId = await getUserOrganizationId((req as AuthRequest).userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Active carers + managers for roster / availability UIs (managers only — carers manage only self)
router.get('/staff', authenticate, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const organizationId = await getUserOrganizationId((req as AuthRequest).userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });
    const users = await prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        role: { in: [UserRole.CARER, UserRole.MANAGER] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Get staff directory error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });

    // Users can only view their own profile unless they're admin/manager
    if (id !== req.userId && req.userRole !== 'ADMIN' && req.userRole !== 'MANAGER') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const user = await prisma.user.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user (Admin only)
router.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const data = createUserSchema.parse(req.body);
    const organizationId = await getUserOrganizationId((req as AuthRequest).userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });

    const user = await usersService.createUser(
      {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
        phone: data.phone,
      },
      organizationId
    );

    res.status(201).json(user);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    // Handle Prisma unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'field';
      return res.status(400).json({ 
        error: `${field === 'email' ? 'Email' : 'Phone'} already exists` 
      });
    }
    
    console.error('Create user error:', error);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update user
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'No organization assigned' });

    // Users can only update their own profile (except role/isActive), admins can update anyone
    if (id !== req.userId && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Only admins can change role and isActive
    if ((data.role !== undefined || data.isActive !== undefined) && req.userRole !== 'ADMIN') {
      return res.status(403).json({ error: 'Cannot modify role or active status' });
    }

    const payload = { ...data };
    if (req.userRole !== 'ADMIN') {
      delete (payload as { role?: unknown }).role;
      delete (payload as { isActive?: unknown }).isActive;
    }

    const user = await usersService.updateUser(id, payload, organizationId);
    res.json(user);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    const pe = error as { code?: string; meta?: { target?: string[] } };
    if (pe.code === 'P2002') {
      const target = pe.meta?.target;
      const field = Array.isArray(target) ? target[0] : undefined;
      if (field === 'email') {
        return res.status(400).json({ error: 'Email already in use' });
      }
      if (field === 'phone') {
        return res.status(400).json({ error: 'Phone number already in use' });
      }
      return res.status(400).json({ error: 'A unique field already exists' });
    }
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

