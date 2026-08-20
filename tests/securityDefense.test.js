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

    it('should block requests after 5 consecutive failures', () => {
      // Simulate 5 failed requests
      for (let i = 0; i < 5; i++) {
        const localRes = {
          statusCode: 401,
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
          on: jest.fn().mockImplementation((event, cb) => {
            if (event === 'finish') cb();
          }),
        };
        authFailRateLimiter(req, localRes, next);
      }

      // 6th request should fail with 429
      const blockedRes = {
        statusCode: 200,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        on: jest.fn(),
      };
      const blockedNext = jest.fn();

      authFailRateLimiter(req, blockedRes, blockedNext);

      expect(blockedRes.status).toHaveBeenCalledWith(429);
      expect(blockedRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'TOO_MANY_REQUESTS',
        }),
      );
      expect(blockedNext).not.toHaveBeenCalled();
    });
  });
});
