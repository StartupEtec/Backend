import { rateLimit } from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per 15 minutes
  standardHeaders: true, // Return rate limit info in standard headers
  legacyHeaders: false, // Disable legacy X-RateLimit headers
  message: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Demasiados intentos de autenticación. Por favor, intente de nuevo en 15 minutos.',
    statusCode: 429,
    timestamp: new Date().toISOString(),
  },
  skip: (req) => process.env.NODE_ENV === 'test', // Skip rate limiting during testing to prevent tests from failing
});
