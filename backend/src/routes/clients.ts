import express from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { createClientSchema, updateClientSchema } from '../schemas/clientProfile';
import { getUserOrganizationId } from '../lib/organization';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads/client-documents');
const allowedMimeTypes = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]);
const maxUploadBytes = 10 * 1024 * 1024; // 10MB
const uploadCategorySchema = z
  .enum(['CARE_PLAN', 'CONSENT', 'MEDICATION', 'RISK_ASSESSMENT', 'OTHER'])
  .default('OTHER');

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      } catch (error) {
        cb(error as Error, uploadDir);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '');
      const baseName = path
        .basename(file.originalname || 'document', ext)
        .replace(/[^a-zA-Z0-9-_]/g, '_')
        .slice(0, 60);
      const timestamp = Date.now();
      const random = Math.random().toString(36).slice(2, 8);
      cb(null, `${timestamp}-${random}-${baseName || 'document'}${ext}`);
    },
  }),
  limits: { fileSize: maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error('Unsupported file type'));
      return;
    }
    cb(null, true);
  },
});

// Get all clients
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const clients = await prisma.client.findMany({
      where: { active: true, organizationId },
      orderBy: { name: 'asc' },
    });

    res.json(clients);
  } catch (error) {
    console.error('Get clients error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get client by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, organizationId },
      include: {
        templates: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// List client documents
router.get('/:id/documents', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });

    const existingClient = await prisma.client.findFirst({
      where: { id: req.params.id, organizationId },
      select: { id: true },
    });
    if (!existingClient) return res.status(404).json({ error: 'Client not found' });

    const docs = await prisma.clientDocument.findMany({
      where: { clientId: req.params.id, organizationId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        category: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    res.json(docs);
  } catch (error) {
    console.error('List client documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload client document (Admin/Manager only)
router.post(
  '/:id/documents',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      const organizationId = await getUserOrganizationId(req.userId!);
      if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });

      const existingClient = await prisma.client.findFirst({
        where: { id: req.params.id, organizationId },
        select: { id: true },
      });
      if (!existingClient) {
        if (req.file) await fs.unlink(req.file.path).catch(() => undefined);
        return res.status(404).json({ error: 'Client not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Invalid input', message: 'No file uploaded' });
      }
      const category = uploadCategorySchema.parse(req.body?.category);

      const document = await prisma.clientDocument.create({
        data: {
          clientId: req.params.id,
          organizationId,
          originalName: req.file.originalname,
          storageName: req.file.filename,
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          category,
          uploadedByUserId: req.userId!,
        },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          category: true,
          createdAt: true,
          uploadedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      });

      res.status(201).json(document);
    } catch (error: any) {
      if (req.file) await fs.unlink(req.file.path).catch(() => undefined);
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Invalid input', message: 'File too large (max 10MB)' });
      }
      if (error?.message === 'Unsupported file type') {
        return res.status(400).json({ error: 'Invalid input', message: 'Unsupported file type' });
      }
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid input', message: 'Invalid document category' });
      }
      console.error('Upload client document error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Download client document
router.get('/:id/documents/:documentId/download', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });

    const document = await prisma.clientDocument.findFirst({
      where: {
        id: req.params.documentId,
        clientId: req.params.id,
        organizationId,
      },
      select: {
        storageName: true,
        originalName: true,
        mimeType: true,
      },
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.join(uploadDir, document.storageName);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(document.originalName)}"`);
    res.sendFile(filePath, (err) => {
      if (err) {
        if (!res.headersSent) {
          res.status(404).json({ error: 'File not found' });
        }
      }
    });
  } catch (error) {
    console.error('Download client document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Preview client document inline
router.get('/:id/documents/:documentId/preview', authenticate, async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });

    const document = await prisma.clientDocument.findFirst({
      where: {
        id: req.params.documentId,
        clientId: req.params.id,
        organizationId,
      },
      select: {
        storageName: true,
        originalName: true,
        mimeType: true,
      },
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.join(uploadDir, document.storageName);
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName)}"`);
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: 'File not found' });
      }
    });
  } catch (error) {
    console.error('Preview client document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete client document (Admin/Manager only)
router.delete(
  '/:id/documents/:documentId',
  authenticate,
  requireRole('ADMIN', 'MANAGER'),
  async (req: AuthRequest, res) => {
    try {
      const organizationId = await getUserOrganizationId(req.userId!);
      if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });

      const document = await prisma.clientDocument.findFirst({
        where: {
          id: req.params.documentId,
          clientId: req.params.id,
          organizationId,
        },
        select: { id: true, storageName: true },
      });
      if (!document) return res.status(404).json({ error: 'Document not found' });

      await prisma.clientDocument.delete({ where: { id: document.id } });
      await fs.unlink(path.join(uploadDir, document.storageName)).catch(() => undefined);
      res.status(204).send();
    } catch (error) {
      console.error('Delete client document error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Create client (Admin/Manager only)
router.post('/', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const data = createClientSchema.parse(req.body);
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });

    const client = await prisma.client.create({
      data: { ...data, organizationId },
    });

    res.status(201).json(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update client (Admin/Manager only)
router.patch('/:id', authenticate, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateClientSchema.parse(req.body);
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });

    const existing = await prisma.client.findFirst({ where: { id, organizationId }, select: { id: true } });
    if (!existing) return res.status(404).json({ error: 'Client not found' });

    const client = await prisma.client.update({
      where: { id },
      data,
    });

    res.json(client);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete client (Admin only - soft delete)
router.delete('/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res) => {
  try {
    const organizationId = await getUserOrganizationId(req.userId!);
    if (!organizationId) return res.status(403).json({ error: 'FORBIDDEN', message: 'No organization assigned' });
    const existing = await prisma.client.findFirst({
      where: { id: req.params.id, organizationId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Client not found' });

    const client = await prisma.client.update({
      where: { id: req.params.id },
      data: { active: false },
    });

    res.json(client);
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Invalid input', message: 'File too large (max 10MB)' });
  }
  if (err?.message === 'Unsupported file type') {
    return res.status(400).json({ error: 'Invalid input', message: 'Unsupported file type' });
  }
  return next(err);
});

export default router;

