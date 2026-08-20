import { rateLimit } from 'express-rate-limit';

// 1. Limitador global: 1000 peticiones por minuto por IP
export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Límite de solicitudes global excedido. Intente más tarde.',
    statusCode: 429,
    timestamp: new Date().toISOString(),
  },
  skip: () => process.env.NODE_ENV === 'test',
});

// 2. Limitador de creación de órdenes: 20 por hora por usuario (usando user_id)
export const orderRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.user_id || req.ip,
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Límite de creación de órdenes excedido (máximo 20 por hora).',
    statusCode: 429,
    timestamp: new Date().toISOString(),
  },
  skip: () => process.env.NODE_ENV === 'test',
});

// 3. Limitador de intentos fallidos de autenticación: 5 intentos fallidos / 15 minutos
const failedAttempts = new Map();

export const authFailRateLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && !req.testRateLimit) {
    return next();
  }

  const ip = req.ip;
  const record = failedAttempts.get(ip);
  const now = Date.now();

  if (record) {
    if (now > record.resetTime) {
      failedAttempts.delete(ip);
    } else if (record.count >= 5) {
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message:
          'Demasiados intentos de autenticación fallidos. Por favor, intente de nuevo en 15 minutos.',
        statusCode: 429,
        timestamp: new Date().toISOString(),
      });
    }
  }

  res.on('finish', () => {
    // Si la respuesta es un error de cliente (credenciales inválidas, otp incorrecto, etc.)
    if (res.statusCode >= 400 && res.statusCode < 500) {
      const current = failedAttempts.get(ip);
      const timestamp = Date.now();
      if (!current) {
        failedAttempts.set(ip, {
          count: 1,
          resetTime: timestamp + 15 * 60 * 1000,
        });
      } else {
        current.count++;
      }
    } else if (res.statusCode >= 200 && res.statusCode < 300) {
      // Limpiar los intentos fallidos si se logra autenticar de forma exitosa
      failedAttempts.delete(ip);
    }
  });

  next();
};
export { authFailRateLimiter as authRateLimiter }; // Exportar alias para compatibilidad retroactiva si es necesario
