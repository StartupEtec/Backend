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
// Solo cuentan los fallos reales de autenticación (credenciales u OTP). Los errores
// de validación del payload (VALIDATION_ERROR) NO queman la IP: no están relacionados
// con un intento de login/OTP real y permitirían un DoS trivial con cuerpos inválidos.
const AUTH_FAILURE_CODES = new Set([
  'AUTH_FAILED',
  'INVALID_OTP',
  'EXPIRED_OTP',
  'OTP_ATTEMPTS_EXCEEDED',
  'INVALID_RESET_CODE',
  'EXPIRED_RESET_CODE',
  'INVALID_REFRESH_TOKEN',
  'INVALID_TOKEN',
]);
const failedAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export const authFailRateLimiter = (req, res, next) => {
  if (process.env.NODE_ENV === 'test' && !req.testRateLimit) {
    return next();
  }

  // Capturar el body de la respuesta (vía closure) para decidir, en 'finish', si
  // fue un fallo de autenticación real. No dependemos de res.locals para que el
  // middleware siga siendo testeable con objetos res mínimos.
  let responseBody = {};
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  const ip = req.ip;
  const record = failedAttempts.get(ip);
  const now = Date.now();

  if (record) {
    if (now > record.resetTime) {
      failedAttempts.delete(ip);
    } else if (record.count >= MAX_FAILED_ATTEMPTS) {
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
    // Solo incrementar ante fallos reales de autenticación, no ante cualquier 4xx.
    if (res.statusCode >= 400 && res.statusCode < 500) {
      const body = responseBody || {};
      if (!AUTH_FAILURE_CODES.has(body.error)) {
        return;
      }
      const current = failedAttempts.get(ip);
      if (!current) {
        failedAttempts.set(ip, {
          count: 1,
          resetTime: Date.now() + WINDOW_MS,
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
