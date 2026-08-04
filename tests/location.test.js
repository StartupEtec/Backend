import { jest } from '@jest/globals';

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  first: jest.fn().mockResolvedValue(null),
  returning: jest.fn().mockResolvedValue([1]),
  select: jest.fn().mockReturnThis(),
  count: jest.fn().mockResolvedValue([{ total: '0' }]),
  orderBy: jest.fn().mockResolvedValue([]),
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

const { default: locationService } = await import('../src/services/LocationService.js');
const { default: locationController } = await import('../src/controllers/LocationController.js');
const { createLocationSchema, updateLocationSchema, listLocationsQuerySchema } =
  await import('../src/utils/validation.js');

const BASE_LOCATION = {
  id: 'loc-uuid',
  user_id: 'user-uuid',
  address: 'Calle Falsa 123, Bogotá',
  latitude: '4.711',
  longitude: '-74.0721',
  is_primary: false,
  created_at: new Date(),
  updated_at: new Date(),
};

const resetMocks = () => {
  mockQueryBuilder.where.mockReset().mockReturnThis();
  mockQueryBuilder.orWhere.mockReset().mockReturnThis();
  mockQueryBuilder.insert.mockReset().mockReturnThis();
  mockQueryBuilder.update.mockReset().mockResolvedValue(1);
  mockQueryBuilder.del.mockReset().mockResolvedValue(1);
  mockQueryBuilder.first.mockReset().mockResolvedValue(null);
  mockQueryBuilder.returning.mockReset().mockResolvedValue([1]);
  mockQueryBuilder.select.mockReset().mockReturnThis();
  mockQueryBuilder.count.mockReset().mockResolvedValue([{ total: '0' }]);
  mockQueryBuilder.orderBy.mockReset().mockResolvedValue([]);
};

describe('Location Service', () => {
  beforeEach(resetMocks);

  describe('createLocation', () => {
    it('should create a location and mark the first one as primary', async () => {
      const newLocation = { ...BASE_LOCATION, is_primary: true };
      mockQueryBuilder.count.mockResolvedValue([{ total: '0' }]);
      mockQueryBuilder.returning.mockResolvedValue([newLocation]);

      const result = await locationService.createLocation('user-uuid', {
        address: 'Calle Falsa 123, Bogotá',
        latitude: 4.711,
        longitude: -74.0721,
      });

      expect(result).toBeDefined();
      expect(result.is_primary).toBe(true);
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it('should return error when limit of 10 is reached', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ total: '10' }]);

      const result = await locationService.createLocation('user-uuid', {
        address: 'Calle Falsa 123, Bogotá',
        latitude: 4.711,
        longitude: -74.0721,
      });

      expect(result).toEqual({ error: 'LOCATION_LIMIT_REACHED' });
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });
  });

  describe('listLocations', () => {
    it('should return formatted locations with distance when reference point is given', async () => {
      const rowDistance = { ...BASE_LOCATION, distance_m: '1240.5' };
      mockQueryBuilder.orderBy.mockResolvedValue([rowDistance]);

      const result = await locationService.listLocations('user-uuid', 4.711, -74.0721);

      expect(result).toHaveLength(1);
      expect(result[0].latitude).toBe(4.711);
      expect(result[0].distance_m).toBe(1240.5);
    });

    it('should return empty array when user has no locations', async () => {
      const result = await locationService.listLocations('user-uuid', null, null);
      expect(result).toEqual([]);
    });
  });

  describe('getLocationById', () => {
    it('should return null when location does not exist', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      const result = await locationService.getLocationById('missing');
      expect(result).toBeNull();
    });

    it('should return formatted location when it exists', async () => {
      mockQueryBuilder.first.mockResolvedValue(BASE_LOCATION);
      const result = await locationService.getLocationById('loc-uuid');
      expect(result).toBeDefined();
      expect(result.address).toBe('Calle Falsa 123, Bogotá');
      expect(result.latitude).toBe(4.711);
    });
  });

  describe('updateLocation', () => {
    it('should return null when location does not exist or is not owned', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      const result = await locationService.updateLocation('loc-uuid', 'user-uuid', {
        address: 'x',
      });
      expect(result).toBeNull();
    });

    it('should update fields of an owned location', async () => {
      const existing = { ...BASE_LOCATION, address: 'Vieja', latitude: '1.0' };
      const updated = { ...BASE_LOCATION, address: 'Nueva', latitude: '4.711', is_primary: true };
      mockQueryBuilder.first.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);

      const result = await locationService.updateLocation('loc-uuid', 'user-uuid', {
        address: 'Nueva',
        is_primary: true,
      });

      expect(result).toBeDefined();
      expect(result.address).toBe('Nueva');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });
  });

  describe('deleteLocation', () => {
    it('should return true when a location is deleted', async () => {
      mockQueryBuilder.del.mockResolvedValue(1);
      const result = await locationService.deleteLocation('loc-uuid', 'user-uuid');
      expect(result).toBe(true);
    });

    it('should return false when nothing is deleted', async () => {
      mockQueryBuilder.del.mockResolvedValue(0);
      const result = await locationService.deleteLocation('loc-uuid', 'user-uuid');
      expect(result).toBe(false);
    });
  });
});

describe('Location Validation Schema', () => {
  describe('createLocationSchema', () => {
    it('should accept valid data', () => {
      const { error } = createLocationSchema.validate({
        address: 'Calle Falsa 123',
        latitude: 4.711,
        longitude: -74.0721,
        is_primary: true,
      });
      expect(error).toBeUndefined();
    });

    it('should reject latitude out of range', () => {
      const { error } = createLocationSchema.validate({
        address: 'Calle Falsa 123',
        latitude: 100,
        longitude: -74.0721,
      });
      expect(error).toBeDefined();
    });

    it('should reject longitude out of range', () => {
      const { error } = createLocationSchema.validate({
        address: 'Calle Falsa 123',
        latitude: 4.711,
        longitude: 200,
      });
      expect(error).toBeDefined();
    });

    it('should require address', () => {
      const { error } = createLocationSchema.validate({
        latitude: 4.711,
        longitude: -74.0721,
      });
      expect(error).toBeDefined();
    });
  });

  describe('updateLocationSchema', () => {
    it('should accept partial update', () => {
      const { error } = updateLocationSchema.validate({ is_primary: true });
      expect(error).toBeUndefined();
    });

    it('should reject empty body', () => {
      const { error } = updateLocationSchema.validate({});
      expect(error).toBeDefined();
    });

    it('should reject invalid latitude', () => {
      const { error } = updateLocationSchema.validate({ latitude: -100 });
      expect(error).toBeDefined();
    });
  });

  describe('listLocationsQuerySchema', () => {
    it('should require both lat and lng together', () => {
      const { error } = listLocationsQuerySchema.validate({ lat: 4.711 });
      expect(error).toBeDefined();
    });

    it('should accept both lat and lng', () => {
      const { error } = listLocationsQuerySchema.validate({ lat: 4.711, lng: -74.0721 });
      expect(error).toBeUndefined();
    });
  });
});

describe('Location Controller', () => {
  beforeEach(resetMocks);

  describe('create', () => {
    it('should return 403 for another user', async () => {
      const req = {
        params: { id: 'other-user' },
        user: { user_id: 'current-user' },
        body: { address: 'x', latitude: 4, longitude: -74 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 for invalid coordinates', async () => {
      const req = {
        params: { id: 'same-user' },
        user: { user_id: 'same-user' },
        body: { address: 'Calle', latitude: 999, longitude: -74 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 201 on success', async () => {
      mockQueryBuilder.returning.mockResolvedValue([BASE_LOCATION]);
      const req = {
        params: { id: 'same-user' },
        user: { user_id: 'same-user' },
        body: { address: 'Calle Falsa 123', latitude: 4.711, longitude: -74.0721 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 409 when limit is reached', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ total: '10' }]);
      const req = {
        params: { id: 'same-user' },
        user: { user_id: 'same-user' },
        body: { address: 'Calle Falsa 123', latitude: 4.711, longitude: -74.0721 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
    });
  });

  describe('list', () => {
    it('should return 403 for another user', async () => {
      const req = {
        params: { id: 'other-user' },
        user: { user_id: 'current-user' },
        query: {},
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.list(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 200 with locations', async () => {
      mockQueryBuilder.orderBy.mockResolvedValue([BASE_LOCATION]);
      const req = {
        params: { id: 'same-user' },
        user: { user_id: 'same-user' },
        query: {},
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.list(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].count).toBe(1);
    });
  });

  describe('getById', () => {
    it('should return 404 when location does not exist', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      const req = {
        params: { location_id: 'missing' },
        user: { user_id: 'current-user' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.getById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 when location belongs to the user', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        ...BASE_LOCATION,
        user_id: 'current-user',
      });
      const req = {
        params: { location_id: 'loc-uuid' },
        user: { user_id: 'current-user' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.getById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('update', () => {
    it('should return 400 for empty body', async () => {
      const req = {
        params: { location_id: 'loc-uuid' },
        user: { user_id: 'user-uuid' },
        body: {},
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.update(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when location is not owned', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      const req = {
        params: { location_id: 'loc-uuid' },
        user: { user_id: 'user-uuid' },
        body: { address: 'Nueva' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.update(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 on update', async () => {
      mockQueryBuilder.first
        .mockResolvedValueOnce(BASE_LOCATION)
        .mockResolvedValueOnce({ ...BASE_LOCATION, address: 'Nueva' });
      const req = {
        params: { location_id: 'loc-uuid' },
        user: { user_id: 'user-uuid' },
        body: { address: 'Nueva' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.update(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('remove', () => {
    it('should return 404 when location is not owned', async () => {
      mockQueryBuilder.del.mockResolvedValue(0);
      const req = {
        params: { location_id: 'loc-uuid' },
        user: { user_id: 'user-uuid' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.remove(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 on delete', async () => {
      mockQueryBuilder.del.mockResolvedValue(1);
      const req = {
        params: { location_id: 'loc-uuid' },
        user: { user_id: 'user-uuid' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await locationController.remove(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
