import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import carerRoutes from './routes/carer';
import managerRoutes from './routes/manager';
import adminRoutes from './routes/admin';
// Keep legacy routes for backward compatibility (can be removed later)
import userRoutes from './routes/users';
import clientRoutes from './routes/clients';
import visitRoutes from './routes/visits';
import scheduleRoutes from './routes/schedules';
import checklistRoutes from './routes/checklists';
import noteRoutes from './routes/notes';
import availabilityRoutes from './routes/availability';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API v1 routes (new structure per spec)
const v1Router = express.Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/carer', carerRoutes);
v1Router.use('/manager', managerRoutes);
v1Router.use('/admin', adminRoutes);
app.use('/api/v1', v1Router);

// Legacy routes (for backward compatibility - can be removed after migration)
app.use('/api/auth', authRoutes);
app.use('/api/carer', carerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/checklists', checklistRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/availability', availabilityRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 API v1 available at /api/v1`);
});

