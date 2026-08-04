import { jest } from '@jest/globals';

const mockCache = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
};

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  whereRaw: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  offset: jest.fn().mockResolvedValue([]),
};

const mockKnex = Object.assign(() => mockQueryBuilder, {
  schema: {
    alterTable: jest.fn(),
    createTable: jest.fn(),
    dropTableIfExists: jest.fn(),
  },
  fn: { now: () => new Date() },
  raw: (val) => val,
});

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));
jest.unstable_mockModule('../src/utils/cache.js', () => ({ default: mockCache }));

const { default: workerSearchService } = await import('../src/services/WorkerSearchService.js');
const { default: workerSearchController } =
  await import('../src/controllers/WorkerSearchController.js');
const { nearbyWorkersQuerySchema } = await import('../src/utils/validation.js');

const resetMocks = () => {
  mockCache.get.mockReset().mockResolvedValue(null);
  mockCache.set.mockReset().mockResolvedValue(undefined);

  mockQueryBuilder.where.mockReset().mockReturnThis();
  mockQueryBuilder.whereRaw.mockReset().mockReturnThis();
  mockQueryBuilder.join.mockReset().mockReturnThis();
  mockQueryBuilder.leftJoin.mockReset().mockReturnThis();
  mockQueryBuilder.select.mockReset().mockReturnThis();
  mockQueryBuilder.orderBy.mockReset().mockReturnThis();
  mockQueryBuilder.limit.mockReset().mockReturnThis();
  mockQueryBuilder.offset.mockReset().mockResolvedValue([]);
};

const BASE_ROW = {
  worker_id: 'worker-uuid',
  user_id: 'user-uuid',
  full_name: 'Carlos García',
  avatar_url: 'https://example.com/avatar.jpg',
  category_id: 'cat-uuid',
  category_name: 'Plomería',
  hourly_rate: '35.50',
  availability_status: 'AVAILABLE',
  certification_status: 'APPROVED',
  average_rating: '4.5',
  distance_m: '1240.5',
  latitude: '4.711',
  longitude: '-74.0721',
};

describe('Worker Search Service', () => {
  beforeEach(resetMocks);

  describe('findNearby', () => {
    it('should return cached result on cache hit', async () => {
      const cachedResult = { workers: [], count: 0, limit: 20, offset: 0 };
      mockCache.get.mockResolvedValue(cachedResult);

      const result = await workerSearchService.findNearby({
        latitude: 4.7,
        longitude: -74.07,
        radius_km: 10,
        limit: 20,
        offset: 0,
      });

      expect(result).toEqual(cachedResult);
      expect(mockQueryBuilder.select).not.toHaveBeenCalled();
    });

    it('should query DB, format rows and cache the result when cache misses', async () => {
      mockQueryBuilder.offset.mockResolvedValue([BASE_ROW]);

      const result = await workerSearchService.findNearby({
        latitude: 4.7,
        longitude: -74.07,
        radius_km: 10,
        limit: 20,
        offset: 0,
      });

      expect(mockCache.get).toHaveBeenCalled();
      expect(mockQueryBuilder.select).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
      expect(result.count).toBe(1);
      expect(result.workers[0].worker_id).toBe('worker-uuid');
      expect(result.workers[0].hourly_rate).toBe(35.5);
      expect(result.workers[0].distance_km).toBe(1.24);
      expect(result.workers[0].average_rating).toBe('4.5');
    });

    it('should filter by category when category_id is provided', async () => {
      mockQueryBuilder.offset.mockResolvedValue([BASE_ROW]);

      await workerSearchService.findNearby({
        latitude: 4.7,
        longitude: -74.07,
        radius_km: 10,
        category_id: 'cat-uuid',
        limit: 20,
        offset: 0,
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('wp.category_id', 'cat-uuid');
    });

    it('should enforce ST_DWithin radius filter with meters', async () => {
      mockQueryBuilder.offset.mockResolvedValue([]);

      await workerSearchService.findNearby({
        latitude: 4.7,
        longitude: -74.07,
        radius_km: 5,
        limit: 20,
        offset: 0,
      });

      expect(mockQueryBuilder.whereRaw).toHaveBeenCalled();
    });
  });
});

describe('Nearby Workers Validation Schema', () => {
  it('should accept valid query', () => {
    const { error, value } = nearbyWorkersQuerySchema.validate({
      latitude: 4.711,
      longitude: -74.0721,
      radius_km: 10,
      category_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      limit: 30,
      offset: 0,
    });
    expect(error).toBeUndefined();
    expect(value.limit).toBe(30);
  });

  it('should apply defaults for limit and offset', () => {
    const { error, value } = nearbyWorkersQuerySchema.validate({
      latitude: 4.711,
      longitude: -74.0721,
      radius_km: 10,
    });
    expect(error).toBeUndefined();
    expect(value.limit).toBe(20);
    expect(value.offset).toBe(0);
  });

  it('should reject radius_km above 100', () => {
    const { error } = nearbyWorkersQuerySchema.validate({
      latitude: 4.711,
      longitude: -74.0721,
      radius_km: 500,
    });
    expect(error).toBeDefined();
  });

  it('should reject radius_km below 1', () => {
    const { error } = nearbyWorkersQuerySchema.validate({
      latitude: 4.711,
      longitude: -74.0721,
      radius_km: 0.5,
    });
    expect(error).toBeDefined();
  });

  it('should require latitude and longitude', () => {
    const { error } = nearbyWorkersQuerySchema.validate({ radius_km: 10 });
    expect(error).toBeDefined();
  });

  it('should reject limit above 100', () => {
    const { error } = nearbyWorkersQuerySchema.validate({
      latitude: 4.711,
      longitude: -74.0721,
      radius_km: 10,
      limit: 500,
    });
    expect(error).toBeDefined();
  });
});

describe('Worker Search Controller', () => {
  beforeEach(resetMocks);

  it('should return 400 for invalid query params', async () => {
    const req = { query: { radius_km: 500 } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await workerSearchController.nearby(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 200 with results', async () => {
    mockQueryBuilder.offset.mockResolvedValue([BASE_ROW]);
    const req = {
      query: { latitude: 4.711, longitude: -74.0721, radius_km: 10 },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await workerSearchController.nearby(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].count).toBe(1);
  });
});
