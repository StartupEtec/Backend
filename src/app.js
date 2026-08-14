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
import { setupSwagger } from './utils/swagger.js';

dotenv.config();

const app = express();

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

app.use(express.json());

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

// Archivos adjuntos (imágenes de mensajes comprimidas)
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads')));

// Endpoint de salud (Health Check)
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
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
