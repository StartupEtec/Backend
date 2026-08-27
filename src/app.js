import express from 'express';
import path from 'node:path';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import workerRoutes from './routes/workerRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import quoteRoutes from './routes/quoteRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import paymentProcessRoutes from './routes/paymentProcessRoutes.js';
import certificationRoutes from './routes/certificationRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import disputeRoutes from './routes/disputeRoutes.js';
import availabilityRoutes from './routes/availabilityRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import healthService from './services/HealthService.js';
import helmet from 'helmet';
import { apmMiddleware } from './middlewares/apm.js';
import { globalRateLimiter } from './middlewares/rateLimiter.js';
import { sanitizeMiddleware } from './middlewares/sanitize.js';
import { setupSwagger } from './utils/swagger.js';

dotenv.config();

const app = express();

// APM Middleware registrado al inicio para medir latencias precisas
app.use(apmMiddleware);

// Encabezados de seguridad HTTP (Helmet) y Rate Limiting global para mitigar DDoS
app.use(helmet());
app.use(globalRateLimiter);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }),
);

app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl && req.originalUrl.includes('/webhooks')) {
        req.rawBody = buf;
      }
    },
  }),
);

// Sanitización recursiva de parámetros para prevenir ataques XSS
app.use(sanitizeMiddleware);

// Configurar Swagger
setupSwagger(app);

// Rutas
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/locations', locationRoutes);
app.use('/api/v1/workers', workerRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1', quoteRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payment-methods', paymentRoutes);
app.use('/api/v1', paymentProcessRoutes);
app.use('/api/v1', certificationRoutes);
app.use('/api/v1', ratingRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1', availabilityRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Archivos adjuntos (imágenes de mensajes comprimidas)
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads')));

// Rutas de Health Check y Monitoreo (Dashboard /health)
app.use(healthRoutes);

// Endpoint heredado de salud (Health Check v1) redirigido a la lógica central
app.get('/api/v1/health', async (req, res, next) => {
  try {
    const health = await healthService.getBasicHealth();
    res.status(200).json(health);
  } catch (err) {
    next(err);
  }
});

// Middleware centralizado de manejo de errores
app.use((err, req, res, next) => {
  const statusCode = err.message === 'Not allowed by CORS' ? 403 : 500;

  res.status(statusCode).json({
    error: statusCode === 403 ? 'CORS_ERROR' : 'INTERNAL_SERVER_ERROR',
    message: err.message || 'Ocurrió un error interno en el servidor',
    statusCode,
    timestamp: new Date().toISOString(),
  });
});

export default app;
