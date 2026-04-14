import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { createClientSchema, updateClientSchema } from '../schemas/clientProfile';

export const clientsService = {
  async getClients() {
    return await prisma.client.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
  },

  async getClientById(id: string) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        templates: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!client) {
      const error: any = new Error('Client not found');
      error.status = 404;
      throw error;
    }

    return client;
  },

  async createClient(data: any) {
    try {
      const validated = createClientSchema.parse(data);
      if (!data.organizationId) {
        const err: any = new Error('organizationId is required');
        err.status = 400;
        throw err;
      }
      return await prisma.client.create({
        data: { ...validated, organizationId: data.organizationId },
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

  async updateClient(id: string, data: any) {
    try {
      const validated = updateClientSchema.parse(data);
      const client = await prisma.client.findUnique({ where: { id } });
      if (!client) {
        const error: any = new Error('Client not found');
        error.status = 404;
        throw error;
      }

      return await prisma.client.update({
        where: { id },
        data: validated,
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

  async deleteClient(id: string) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      const error: any = new Error('Client not found');
      error.status = 404;
      throw error;
    }

    return await prisma.client.update({
      where: { id },
      data: { active: false },
    });
  },
};

