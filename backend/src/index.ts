import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import authRoutes from './routes/auth';
import carerRoutes from './routes/carer';
import managerRoutes from './routes/manager';
import adminRoutes from './routes/admin';
import emarRoutes from './routes/emar';
import billingRoutes from './routes/billing';
import payrollRoutes from './routes/payroll';
import carePlanRoutes from './routes/carePlans';
import riskRoutes from './routes/risk';
// Keep legacy routes for backward compatibility (can be removed later)
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import visitRoutes from './routes/visits';
import scheduleRoutes from './routes/schedules';
import checklistRoutes from './routes/checklists';
import noteRoutes from './routes/notes';
import availabilityRoutes from './routes/availability';
import incidentRoutes from './routes/incidents';
import guardianRoutes from './routes/guardian';
import { prisma } from './lib/prisma';
import { buildCorsOptions } from './lib/corsConfig';
import { getUserOrganizationId } from './lib/organization';
import { auditLogService } from './services/auditLogService';
import { medicationAlertDetectionService } from './services/medicationAlertDetectionService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '1mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const trackedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  if (!trackedMethods.has(req.method)) return next();

  res.on('finish', () => {
    if (!req.path.startsWith('/api/v1/')) return;
    const actorId = (req as any).userId as string | undefined;
    const actorRole = (req as any).userRole as any;
    if (!actorId) return;
    if (res.statusCode < 200 || res.statusCode >= 400) return;

    void (async () => {
      try {
        const organizationId = await getUserOrganizationId(actorId);
        if (!organizationId) return;
        await auditLogService.log({
          organizationId,
          module: req.path.split('/')[3] || 'system',
          action: req.method,
          actorId,
          actorRole,
          route: req.path,
          method: req.method,
          metadata: {
            statusCode: res.statusCode,
            requestId: res.locals.requestId,
          },
        });
      } catch (error) {
        console.error('audit_log_failed', error);
      }
    })();
  });

  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const headerId = req.headers['x-request-id'];
  const requestId =
    typeof headerId === 'string' && headerId.length > 0 && headerId.length <= 128
      ? headerId
      : randomUUID();
  res.setHeader('X-Request-Id', requestId);
  res.locals.requestId = requestId;
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path === '/health') return;
    const line = {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
    };
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(line));
    } else {
      console.log(line);
    }
  });
  next();
});

// Health check (process up)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness (database reachable)
app.get('/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});

// API v1 routes (new structure per spec)
const v1Router = express.Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/carer', carerRoutes);
v1Router.use('/manager', managerRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/emar', emarRoutes);
v1Router.use('/billing', billingRoutes);
v1Router.use('/payroll', payrollRoutes);
v1Router.use('/care-plans', carePlanRoutes);
v1Router.use('/risk-assessments', riskRoutes);
v1Router.use('/incidents', incidentRoutes);
v1Router.use('/guardian', guardianRoutes);
app.use('/api/v1', v1Router);

// Legacy routes (for backward compatibility - can be removed after migration)
app.use('/api/auth', authRoutes);
app.use('/api/carer', carerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/emar', emarRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/guardian', guardianRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `No route for ${req.method} ${req.path}`,
  });
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = res.locals.requestId;
  const payload: Record<string, unknown> = {
    requestId,
    message: err.message,
    name: err.name,
  };
  if (process.env.NODE_ENV !== 'production') {
    payload.stack = err.stack;
  }
  console.error(JSON.stringify({ level: 'error', ...payload }));
  if (res.headersSent) return;
  res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API v1 available at /api/v1`);
});

const MED_ALERT_CRON_MS = 15 * 60 * 1000;
if (process.env.ENABLE_MED_ALERT_CRON === '1') {
  setInterval(() => {
    medicationAlertDetectionService.runForAllOrganizations().catch((err) => {
      console.error(JSON.stringify({ level: 'error', msg: 'med_alert_cron', error: String(err) }));
    });
  }, MED_ALERT_CRON_MS);
  setTimeout(() => {
    medicationAlertDetectionService.runForAllOrganizations().catch((err) => {
      console.error(JSON.stringify({ level: 'error', msg: 'med_alert_cron_boot', error: String(err) }));
    });
  }, 30_000);
}
