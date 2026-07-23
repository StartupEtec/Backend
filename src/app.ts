import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Configuración de CORS
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

// Endpoint de salud (Health Check)
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// Middleware centralizado de manejo de errores
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.message === 'Not allowed by CORS' ? 403 : 500;
  
  res.status(statusCode).json({
    error: statusCode === 403 ? 'CORS_ERROR' : 'INTERNAL_SERVER_ERROR',
    message: err.message || 'Ocurrió un error interno en el servidor',
    statusCode,
    timestamp: new Date().toISOString(),
  });
});

export default app;
