import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Prisma, UserRole } from '@prisma/client';
import { sendEmailVerificationForUser } from '../lib/emailVerification';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
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

export const usersService = {
  async getUsers(organizationId?: string) {
    return await prisma.user.findMany({
      where: organizationId ? { organizationId } : undefined,
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
  },

  async getUserById(id: string, organizationId?: string) {
    const user = await prisma.user.findUnique({
      where: { id },
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
      const error: any = new Error('User not found');
      error.status = 404;
      throw error;
    }

    if (organizationId) {
      const scoped = await prisma.user.findFirst({
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
      if (!scoped) {
        const error: any = new Error('User not found');
        error.status = 404;
        throw error;
      }
      return scoped;
    }

    return user;
  },

  async createUser(data: any, organizationId?: string) {
    try {
      const validated = createUserSchema.parse(data);
      const passwordHash = await bcrypt.hash(validated.password, 10);

      const user = await prisma.user.create({
        data: {
          name: validated.name.trim(),
          email: validated.email.trim().toLowerCase(),
          phone: validated.phone ?? null,
          role: validated.role,
          passwordHash,
          organizationId,
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
      });

      void sendEmailVerificationForUser(user.id).catch((err) => {
        console.error('Failed to send verification email:', err);
      });

      return user;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const err: any = new Error(error.errors[0].message);
        err.status = 400;
        throw err;
      }
      throw error;
    }
  },

  async updateUser(id: string, data: any, organizationId?: string) {
    try {
      const validated = updateUserSchema.parse(data);
      const user = await prisma.user.findFirst({ where: organizationId ? { id, organizationId } : { id } });
      if (!user) {
        const error: any = new Error('User not found');
        error.status = 404;
        throw error;
      }

      const updateData: Prisma.UserUpdateInput = {};
      if (validated.name !== undefined) updateData.name = validated.name.trim();
      if (validated.phone !== undefined) {
        const trimmed = validated.phone.trim();
        updateData.phone = trimmed.length > 0 ? trimmed : null;
      }
      if (validated.role !== undefined) updateData.role = validated.role;
      if (validated.isActive !== undefined) updateData.isActive = validated.isActive;

      let shouldResendVerification = false;
      if (validated.email !== undefined) {
        const nextEmail = validated.email.trim().toLowerCase();
        updateData.email = nextEmail;
        if (nextEmail !== user.email) {
          updateData.emailVerifiedAt = null;
          shouldResendVerification = true;
        }
      }

      if (Object.keys(updateData).length === 0) {
        const unchanged = await prisma.user.findFirst({
          where: { id },
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
        if (!unchanged) {
          const error: any = new Error('User not found');
          error.status = 404;
          throw error;
        }
        return unchanged;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
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

      if (shouldResendVerification) {
        void sendEmailVerificationForUser(id).catch((err) => {
          console.error('Failed to send verification email after email change:', err);
        });
      }

      return updated;
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

