import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendEmailVerificationForUser, verifyEmailWithToken } from '../lib/emailVerification';

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(2),
  companyName: z.string().trim().min(2),
  organizationCode: z.string().trim().min(2).max(10),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

const createOrganizationSchema = z.object({
  companyName: z.string().trim().min(2),
  organizationCode: z.string().trim().min(2).max(10),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  organizationCode: z.string().trim().min(2).max(10),
  password: z.string().min(6),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email(),
});

router.post('/organizations', async (req, res) => {
  try {
    const { companyName, organizationCode } = createOrganizationSchema.parse(req.body);
    const normalizedCompanyName = companyName.trim().toLowerCase();
    const normalizedOrganizationCode = organizationCode.trim().toUpperCase();

    const existingByName = await prisma.organization.findUnique({
      where: { nameNormalized: normalizedCompanyName },
      select: { id: true },
    });
    if (existingByName) {
      return res.status(409).json({
        error: 'ORGANIZATION_EXISTS',
        message: 'An organization with this name already exists.',
      });
    }

    const existingByCode = await prisma.organization.findUnique({
      where: { code: normalizedOrganizationCode },
      select: { id: true },
    });
    if (existingByCode) {
      return res.status(409).json({
        error: 'ORGANIZATION_CODE_IN_USE',
        message: 'This organization code is already in use.',
      });
    }

    const organization = await prisma.organization.create({
      data: {
        name: companyName.trim(),
        nameNormalized: normalizedCompanyName,
        code: normalizedOrganizationCode,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });
    res.status(201).json(organization);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, companyName, organizationCode, email, password } = registerSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({ error: 'EMAIL_IN_USE', message: 'Email is already in use' });
    }

    const normalizedCompanyName = companyName.trim().toLowerCase();
    const normalizedOrganizationCode = organizationCode.trim().toUpperCase();
    const organization = await prisma.organization.findFirst({
      where: {
        nameNormalized: normalizedCompanyName,
        code: normalizedOrganizationCode,
      },
    });

    if (!organization) {
      return res.status(400).json({
        error: 'ORGANIZATION_MISMATCH',
        message: 'Organization name and code do not match our records.',
      });
    }

    const existingPendingRequest = await prisma.organizationJoinRequest.findFirst({
      where: {
        organizationId: organization.id,
        requesterEmail: normalizedEmail,
        status: 'PENDING',
      },
    });

    if (existingPendingRequest) {
      return res.status(409).json({
        error: 'JOIN_REQUEST_EXISTS',
        message: 'A pending join request already exists for this email and organization.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const organizationAdminCount = await prisma.user.count({
      where: { organizationId: organization.id, role: 'ADMIN', isActive: true },
    });

    if (organizationAdminCount === 0) {
      const user = await prisma.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: 'ADMIN',
          organizationId: organization.id,
        },
      });
      try {
        await sendEmailVerificationForUser(user.id);
      } catch (err) {
        console.error('Verification email after register:', err);
      }
      return res.status(201).json({
        requiresEmailVerification: true,
        message: 'Check your email to verify your address, then sign in.',
      });
    }

    await prisma.organizationJoinRequest.create({
      data: {
        organizationId: organization.id,
        requesterName: name.trim(),
        requesterEmail: normalizedEmail,
        passwordHash,
        requestedRole: 'CARER',
      },
    });

    res.status(202).json({
      message: 'Your join request has been submitted and is waiting for admin approval.',
      requiresApproval: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, organizationCode, password } = loginSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOrganizationCode = organizationCode.trim().toUpperCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        organization: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    if (!user.organization || user.organization.code !== normalizedOrganizationCode) {
      return res.status(403).json({
        error: 'ORGANIZATION_ACCESS_DENIED',
        message: 'Organization does not match this account.',
      });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' });
    }

    if (!user.emailVerifiedAt) {
      return res.status(403).json({
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before signing in.',
      });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      secret,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        companyName: user.organization?.name ?? null,
        organizationCode: user.organization?.code ?? null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = verifyEmailSchema.parse(req.body);
    const result = await verifyEmailWithToken(token);
    if (!result.ok) {
      return res.status(400).json({
        error: result.reason === 'expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message:
          result.reason === 'expired'
            ? 'This verification link has expired. Request a new one from the sign-in page.'
            : 'Invalid verification link.',
      });
    }
    res.json({ message: 'Email verified. You can sign in now.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = resendVerificationSchema.parse(req.body);
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, emailVerifiedAt: true },
    });
    if (user && !user.emailVerifiedAt) {
      try {
        await sendEmailVerificationForUser(user.id);
      } catch (err) {
        console.error('Resend verification email:', err);
      }
    }
    res.json({
      message:
        'If an account exists for this email and is not verified yet, we sent a new verification link.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        organization: {
          select: {
            name: true,
            code: true,
          },
        },
        isActive: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
    }

    const { emailVerifiedAt, organization, ...profile } = user;

    res.json({
      ...profile,
      emailVerified: !!emailVerifiedAt,
      companyName: organization?.name ?? null,
      organizationCode: organization?.code ?? null,
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash) {
      return res.status(400).json({
        error: 'PASSWORD_CHANGE_UNAVAILABLE',
        message: 'Password change is not available for this account.',
      });
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      return res.status(401).json({
        error: 'INVALID_PASSWORD',
        message: 'Current password is incorrect.',
      });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.userId! },
      data: { passwordHash },
    });
    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.errors[0].message });
    }
    console.error('Change password error:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

export default router;

