import winston from 'winston';
import { AsyncLocalStorage } from 'node:async_hooks';

// AsyncLocalStorage para capturar automáticamente el user_id del contexto de la petición
export const asyncLocalStorage = new AsyncLocalStorage();

const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Formateador personalizado para inyectar automáticamente user_id del almacenamiento asíncrono
const autoUserIdFormat = winston.format((info) => {
  const store = asyncLocalStorage.getStore();
  if (store && store.userId) {
    info.user_id = store.userId;
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    autoUserIdFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'backend-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, user_id, ...metadata }) => {
          let metaStr = '';
          const sanitizedMeta = { ...metadata };
          // Quitar campos sensibles
          delete sanitizedMeta.password;
          delete sanitizedMeta.current_password;
          delete sanitizedMeta.new_password;
          delete sanitizedMeta.token;
          delete sanitizedMeta.otp;
          delete sanitizedMeta.otp_code;
          delete sanitizedMeta.refreshToken;

          if (Object.keys(sanitizedMeta).length) {
            metaStr = ` ${JSON.stringify(sanitizedMeta)}`;
          }

          const userStr = user_id ? ` [User: ${user_id}]` : '';
          return `[${timestamp}] [${level}]${userStr}: ${message}${metaStr}`;
        }),
      ),
    }),
  ],
});

export default logger;
