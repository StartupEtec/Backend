import { jest } from '@jest/globals';

process.env.REDIS_URL = 'redis://localhost:6379';

const redisClient = {
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  quit: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
};

const createClientMock = jest.fn(() => redisClient);

jest.unstable_mockModule('redis', () => ({
  createClient: createClientMock,
}));

const { default: cacheService } = await import('../src/utils/cache.js');

let connectErrorHandler;

describe('CacheService — modo Redis', () => {
  beforeEach(() => {
    // resetAllMocks (config resetMocks) borra la implementación de createClientMock,
    // así que la restauramos aquí junto al resto.
    createClientMock.mockReset().mockReturnValue(redisClient);
    redisClient.on.mockReset();
    redisClient.connect.mockReset().mockResolvedValue(undefined);
    redisClient.quit.mockReset().mockResolvedValue(undefined);
    redisClient.get.mockReset().mockResolvedValue(null);
    redisClient.set.mockReset().mockResolvedValue('OK');
  });

  it('connect con REDIS_URL activa el uso de Redis', async () => {
    await cacheService.connect();
    expect(redisClient.connect).toHaveBeenCalled();
    expect(cacheService.useRedis).toBe(true);
    const [, handler] = redisClient.on.mock.calls[0];
    connectErrorHandler = handler;
  });

  it('get parsea JSON almacenado en Redis', async () => {
    redisClient.get.mockResolvedValue(JSON.stringify({ a: 1 }));
    expect(await cacheService.get('clave')).toEqual({ a: 1 });
  });

  it('get devuelve null cuando Redis no tiene la clave', async () => {
    redisClient.get.mockResolvedValue(null);
    expect(await cacheService.get('clave')).toBeNull();
  });

  it('set serializa el valor con TTL en Redis', async () => {
    await cacheService.set('clave', { a: 1 }, 60);
    expect(redisClient.set).toHaveBeenCalledWith('clave', JSON.stringify({ a: 1 }), { EX: 60 });
  });

  it('disconnect cierra la conexión Redis', async () => {
    await cacheService.disconnect();
    expect(redisClient.quit).toHaveBeenCalled();
  });

  it('degrada a memoria cuando Redis reporta un error de conexión', () => {
    connectErrorHandler(new Error('ECONNREFUSED'));
    expect(cacheService.useRedis).toBe(false);
  });
});
