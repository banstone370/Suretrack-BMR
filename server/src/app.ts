import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import attachmentRoutes from './routes/attachmentRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import authRoutes from './routes/authRoutes.js';
import batchRoutes from './routes/batchRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import dispatchRoutes from './routes/dispatchRoutes.js';
import etoRoutes from './routes/etoRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import productRoutes from './routes/productRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import sopRoutes from './routes/sopRoutes.js';
import userRoutes from './routes/userRoutes.js';
import './types/express.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get('/api/v1/health', (_req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        service: 'suretech-ebmr',
        database: mongoose.connection.name || null,
        readyState: mongoose.connection.readyState,
      },
    });
  });

  app.use('/api/v1/auth', authLimiter, authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/products', productRoutes);
  app.use('/api/v1/batches', batchRoutes);
  app.use('/api/v1/dashboard', dashboardRoutes);
  app.use('/api/v1/eto-cartridges', etoRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/customers', customerRoutes);
  app.use('/api/v1/dispatches', dispatchRoutes);
  app.use('/api/v1/audit-logs', auditRoutes);
  app.use('/api/v1/sops', sopRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/notifications', notificationRoutes);
  app.use('/api/v1/attachments', attachmentRoutes);

  app.use(errorHandler);
  return app;
}
