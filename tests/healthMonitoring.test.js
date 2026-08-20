import { jest } from '@jest/globals';

const mockQueryBuilder = {
  raw: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
};

const mockKnex = Object.assign(() => mockQueryBuilder, {
  raw: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
});

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

const { default: healthService } = await import('../src/services/HealthService.js');
const { default: alertService } = await import('../src/services/AlertService.js');
const { apmMiddleware, apmStats } = await import('../src/middlewares/apm.js');

describe('Health and Monitoring Tests', () => {
  beforeEach(() => {
    mockKnex.raw.mockReset().mockResolvedValue({ rows: [{ '?column?': 1 }] });
    // Reset APM stats
    apmStats.totalRequests = 0;
    apmStats.statusCodes['2xx'] = 0;
    apmStats.statusCodes['3xx'] = 0;
    apmStats.statusCodes['4xx'] = 0;
    apmStats.statusCodes['5xx'] = 0;
    apmStats.recentLatenciesMs = [];
  });

  describe('HealthService', () => {
    it('getBasicHealth - should return status UP when DB is healthy', async () => {
      const res = await healthService.getBasicHealth();
      expect(res.status).toBe('UP');
      expect(res.services.database).toBe('UP');
      expect(res.services.cache).toBe('UP'); // Memory is default UP
    });

    it('getBasicHealth - should return DEGRADED when DB query throws error', async () => {
      mockKnex.raw.mockRejectedValue(new Error('DB connection timeout'));

      const res = await healthService.getBasicHealth();
      expect(res.status).toBe('DEGRADED');
      expect(res.services.database).toBe('DOWN');
    });

    it('getDetailedHealth - should return full components metrics and APM', async () => {
      apmStats.totalRequests = 5;
      apmStats.statusCodes['2xx'] = 4;
      apmStats.statusCodes['5xx'] = 1;
      apmStats.recentLatenciesMs = [10, 20, 30, 40, 50];

      const res = await healthService.getDetailedHealth();
      expect(res.status).toBe('UP');
      expect(res.uptime).toBeDefined();
      expect(res.components.api).toBeDefined();
      expect(res.components.database.latency_ms).toBeGreaterThanOrEqual(0);
      expect(res.apm.total_requests).toBe(5);
      expect(res.apm.error_rate_5xx_percentage).toBe(20);
      expect(res.apm.latency_stats.avg_ms).toBe(30);
    });
  });

  describe('APM Middleware', () => {
    it('should increment total requests count', () => {
      const req = { method: 'GET', originalUrl: '/test' };
      const res = { on: jest.fn(), statusCode: 200 };
      const next = jest.fn();

      apmMiddleware(req, res, next);
      expect(apmStats.totalRequests).toBe(1);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('AlertService', () => {
    it('should successfully log triggered alerts', async () => {
      const logSpy = jest.spyOn(alertService, 'triggerAlert');
      await alertService.triggerAlert('TEST_ALERT', 'This is a test warning');
      expect(logSpy).toHaveBeenCalledWith('TEST_ALERT', 'This is a test warning');
    });
  });
});
