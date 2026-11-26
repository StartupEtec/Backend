import { jest } from '@jest/globals';
import cacheService from '../src/utils/cache.js';

describe('CacheService — modo memoria', () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('connect sin REDIS_URL degrada a caché en memoria', async () => {
    await cacheService.connect();
    expect(cacheService.useRedis).toBe(false);
  });

  it('connect solo intenta conectarse una vez', async () => {
    await cacheService.connect();
    await cacheService.connect();
    expect(cacheService.connectAttempted).toBe(true);
  });

  it('set/get funciona sobre la memoria', async () => {
    await cacheService.set('mi-clave', { a: 1 }, 60);
    expect(await cacheService.get('mi-clave')).toEqual({ a: 1 });
  });

  it('get de una clave inexistente devuelve null', async () => {
    expect(await cacheService.get('no-existe')).toBeNull();
  });

  it('elimina la entrada al expirar su TTL', async () => {
    jest.useFakeTimers();
    await cacheService.set('ttl', 'valor', 1);
    expect(await cacheService.get('ttl')).toBe('valor');
    jest.advanceTimersByTime(1500);
    expect(await cacheService.get('ttl')).toBeNull();
  });

  it('invalidateNearby elimina solo las claves nearby:*', async () => {
    await cacheService.set('nearby:1,2,10', { count: 1 }, 60);
    await cacheService.set('otra-clave', { count: 2 }, 60);

    await cacheService.invalidateNearby();

    expect(await cacheService.get('nearby:1,2,10')).toBeNull();
    expect(await cacheService.get('otra-clave')).toEqual({ count: 2 });
  });

  it('disconnect sin cliente Redis es no-op', async () => {
    await cacheService.disconnect();
    expect(cacheService.client).toBeNull();
  });
});
