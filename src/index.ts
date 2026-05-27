import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import prisma from './config/prisma';
import { redis } from './config/redis';
import { initWhatsApp } from './services/whatsapp';

// ─── Route imports ──────────────────────────────────────────
import authRoutes from './modules/auth/routes';
import patientRoutes from './modules/patients/routes';
import intakeRoutes from './modules/intake/routes';
import riskRoutes from './modules/risk/routes';
import symptomRoutes from './modules/symptoms/routes';
import { symptomTimelineRouter } from './modules/symptoms/routes';
import alertRoutes from './modules/alerts/routes';
import appointmentRoutes from './modules/appointments/routes';
import educationRoutes from './modules/education/routes';
import providerRoutes from './modules/providers/routes';
import adminRoutes from './modules/admin/routes';

const app = express();

// ─── Global Middleware ──────────────────────────────────────
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(requestId);
app.use(pinoHttp({ logger }));

// ─── Health Check ───────────────────────────────────────────
app.get('/health', async (req, res) => {
  let dbStatus = 'ok';
  let redisStatus = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  try {
    await redis.ping();
  } catch {
    redisStatus = 'error';
  }

  const status = dbStatus === 'ok' && redisStatus === 'ok' ? 200 : 503;
  res.status(status).json({
    status: status === 200 ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: { database: dbStatus, redis: redisStatus },
  });
});

// ─── Routes ─────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/patients', patientRoutes);
app.use('/patients', symptomTimelineRouter); // GET /patients/:id/symptoms
app.use('/intake', intakeRoutes);
app.use('/risk', riskRoutes);
app.use('/symptoms', symptomRoutes);
app.use('/alerts', alertRoutes);
app.use('/appointments', appointmentRoutes);
app.use('/education', educationRoutes);
app.use('/providers', providerRoutes);
app.use('/admin', adminRoutes);

// ─── Error Handler ──────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────
const PORT = parseInt(env.PORT, 10);

if (env.NODE_ENV !== 'test') {
  initWhatsApp();
  app.listen(PORT, () => {
    logger.info(`🏥 Mama Care AI server listening on port ${PORT}`);
  });
}

export default app;
