import { jest } from '@jest/globals';

process.env.REDIS_URL = 'redis://localhost:6379';

jest.unstable_mockModule('redis', () => ({
  createClient: jest.fn(() => ({
    on: jest.fn(),
    connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
  })),
}));

const { default: cacheService } = await import('../src/utils/cache.js');

describe('CacheService — fallback a memoria cuando Redis no conecta', () => {
  it('connect ante un fallo de conexión degrada y sigue sirviendo con memoria', async () => {
    await cacheService.connect();
    expect(cacheService.useRedis).toBe(false);

    await cacheService.set('clave', { ok: true }, 60);
    expect(await cacheService.get('clave')).toEqual({ ok: true });
    expect(await cacheService.get('otra')).toBeNull();
  });
});
