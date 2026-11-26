import { jest } from '@jest/globals';
import { sanitizeMiddleware } from '../src/middlewares/sanitize.js';
import { authFailRateLimiter } from '../src/middlewares/rateLimiter.js';

describe('Security and Defense Middleware Tests', () => {
  describe('XSS Input Sanitization Middleware', () => {
    it('should strip script tags recursively from request body, query, and params', () => {
      const req = {
        body: {
          name: 'John <script>alert("xss")</script> Doe',
          nested: {
            bio: '<b>Hello</b> <iframe src="malicious"></iframe> World',
          },
        },
        query: {
          search: '<script>bad</script>test',
        },
        params: {
          id: '123<script></script>',
        },
      };

      const next = jest.fn();
      sanitizeMiddleware(req, {}, next);

      expect(req.body.name).toBe('John  Doe');
      expect(req.body.nested.bio).toBe('Hello  World');
      expect(req.query.search).toBe('test');
      expect(req.params.id).toBe('123');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Custom Auth Failed Attempts Rate Limiter', () => {
    let req;
    let res;
    let next;
    let finishCallbacks;

    beforeEach(() => {
      req = { ip: '192.168.1.1', testRateLimit: true };
      finishCallbacks = [];
      res = {
        statusCode: 200,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation((event, cb) => {
          if (event === 'finish') {
            finishCallbacks.push(cb);
          }
        }),
      };
      next = jest.fn();
    });

    it('should allow normal requests and next()', () => {
      authFailRateLimiter(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block requests after 5 real auth failures', () => {
      // Simulate 5 failed authentication requests (AUTH_FAILED). El middleware
      // parchea res.json para capturar el body y solo cuenta fallos reales.
      for (let i = 0; i < 5; i++) {
        const finishCallbacks = [];
        const localRes = {
          statusCode: 401,
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          on: jest.fn().mockImplementation((event, cb) => {
            if (event === 'finish') finishCallbacks.push(cb);
          }),
        };
        authFailRateLimiter(req, localRes, next);
        localRes.json({ error: 'AUTH_FAILED' }); // cuerpo real de un login fallido
        finishCallbacks.splice(0).forEach((cb) => cb());
      }

      // 6th request should fail with 429. El middleware reemplaza res.json con un
      // wrapper, así que guardamos referencias a los mocks originales para asertar.
      const statusMock = jest.fn().mockReturnThis();
      const jsonMock = jest.fn().mockReturnThis();
      const blockedRes = {
        statusCode: 200,
        status: statusMock,
        json: jsonMock,
        on: jest.fn(),
      };
      const blockedNext = jest.fn();

      authFailRateLimiter(req, blockedRes, blockedNext);

      expect(statusMock).toHaveBeenCalledWith(429);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'TOO_MANY_REQUESTS',
        }),
      );
      expect(blockedNext).not.toHaveBeenCalled();
    });

    it('should NOT count payload validation errors toward the IP limit', () => {
      // Los errores VALIDATION_ERROR no están relacionados con un intento de
      // autenticación; no deben quemar la IP (desacoplados del límite).
      const validationReq = { ip: '192.168.1.2', testRateLimit: true };
      for (let i = 0; i < 10; i++) {
        const finishCallbacks = [];
        const localRes = {
          statusCode: 400,
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          on: jest.fn().mockImplementation((event, cb) => {
            if (event === 'finish') finishCallbacks.push(cb);
          }),
        };
        authFailRateLimiter(validationReq, localRes, next);
        localRes.json({ error: 'VALIDATION_ERROR' });
        finishCallbacks.splice(0).forEach((cb) => cb());
      }

      const blockedRes = {
        statusCode: 200,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };
      const blockedNext = jest.fn();

      authFailRateLimiter(validationReq, blockedRes, blockedNext);

      expect(blockedRes.status).not.toHaveBeenCalledWith(429);
      expect(blockedNext).toHaveBeenCalled();
    });
  });
});
