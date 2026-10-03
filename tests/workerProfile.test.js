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
  avg: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
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

const { default: workerProfileService } = await import('../src/services/WorkerProfileService.js');
const { default: workerProfileController } =
  await import('../src/controllers/WorkerProfileController.js');
const { createWorkerProfileSchema, updateWorkerProfileSchema } =
  await import('../src/utils/validation.js');

describe('Worker Profile Service', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.orWhere.mockReset().mockReturnThis();
    mockQueryBuilder.insert.mockReset().mockReturnThis();
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.del.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.returning.mockReset().mockResolvedValue([1]);
    mockQueryBuilder.select.mockReset().mockReturnThis();
    mockQueryBuilder.avg.mockReset().mockReturnThis();
    mockQueryBuilder.leftJoin.mockReset().mockReturnThis();
  });

  describe('getProfile', () => {
    it('should expose the 4 identity fields of the "Completar Perfil" flow', async () => {
      const mockProfile = {
        id: 'profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Carlos García',
        date_of_birth: new Date(1988, 10, 2),
        avatar_url: '/uploads/profiles/avatar.jpg',
        dni_front_url: '/uploads/profiles/front.jpg',
        dni_back_url: '/uploads/profiles/back.jpg',
        bio: null,
        category_id: null,
        category_name: null,
        hourly_rate: null,
        availability_status: 'AVAILABLE',
        certification_status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueryBuilder.first.mockResolvedValueOnce(mockProfile);
      mockQueryBuilder.avg.mockReturnThis();
      mockQueryBuilder.first.mockResolvedValueOnce({ average: null });

      const result = await workerProfileService.getProfile('user-uuid');

      // pg devuelve DATE como Date en medianoche local; la API la devuelve como YYYY-MM-DD.
      expect(result.date_of_birth).toBe('1988-11-02');
      expect(result.avatar_url).toBe('/uploads/profiles/avatar.jpg');
      expect(result.dni_front_url).toBe('/uploads/profiles/front.jpg');
      expect(result.dni_back_url).toBe('/uploads/profiles/back.jpg');
    });

    it('should return hourly_rate as null, not 0, when the rate is not set yet', async () => {
      const mockProfile = {
        id: 'profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Carlos García',
        date_of_birth: '1988-11-02',
        avatar_url: '/uploads/profiles/avatar.jpg',
        dni_front_url: '/uploads/profiles/front.jpg',
        dni_back_url: '/uploads/profiles/back.jpg',
        category_id: null,
        category_name: null,
        hourly_rate: null,
        availability_status: 'AVAILABLE',
        certification_status: 'PENDING',
      };

      mockQueryBuilder.first.mockResolvedValueOnce(mockProfile);
      mockQueryBuilder.avg.mockReturnThis();
      mockQueryBuilder.first.mockResolvedValueOnce({ average: null });

      const result = await workerProfileService.getProfile('user-uuid');

      expect(result.hourly_rate).toBeNull();
    });

    it('should return null when profile does not exist', async () => {
      const result = await workerProfileService.getProfile('nonexistent-uuid');
      expect(result).toBeNull();
    });

    it('should return profile data with rating when it exists', async () => {
      const mockProfile = {
        id: 'profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Carlos García',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Técnico reparador',
        category_id: 'cat-uuid',
        category_name: 'Plumbing',
        hourly_rate: 35.5,
        availability_status: 'AVAILABLE',
        certification_status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockAvgRating = { average: 4.5 };

      mockQueryBuilder.first.mockResolvedValueOnce(mockProfile);
      mockQueryBuilder.avg.mockReturnThis();
      mockQueryBuilder.first.mockResolvedValueOnce(mockAvgRating);

      const result = await workerProfileService.getProfile('user-uuid');

      expect(result).toBeDefined();
      expect(result.full_name).toBe('Carlos García');
      expect(result.hourly_rate).toBe(35.5);
      expect(result.category_name).toBe('Plumbing');
      expect(result.availability_status).toBe('AVAILABLE');
      expect(result.average_rating).toBe('4.5');
    });

    it('should return null average_rating when no ratings exist', async () => {
      const mockProfile = {
        id: 'profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Carlos García',
        avatar_url: null,
        bio: null,
        category_id: null,
        category_name: null,
        hourly_rate: 30.0,
        availability_status: 'AVAILABLE',
        certification_status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockAvgRating = { average: null };

      mockQueryBuilder.first.mockResolvedValueOnce(mockProfile);
      mockQueryBuilder.avg.mockReturnThis();
      mockQueryBuilder.first.mockResolvedValueOnce(mockAvgRating);

      const result = await workerProfileService.getProfile('user-uuid');

      expect(result).toBeDefined();
      expect(result.average_rating).toBeNull();
    });
  });

  describe('createProfile', () => {
    it('should return null if profile already exists', async () => {
      mockQueryBuilder.first.mockResolvedValue({ id: 'existing' });

      const result = await workerProfileService.createProfile('user-uuid', {
        full_name: 'Test',
        category_id: 'cat-uuid',
        hourly_rate: 25.0,
      });

      expect(result).toBeNull();
    });

    it('should create a new profile and return it', async () => {
      const newProfile = {
        id: 'new-profile-uuid',
        user_id: 'user-uuid',
        full_name: 'New Worker',
        avatar_url: null,
        bio: null,
        category_id: 'cat-uuid',
        hourly_rate: 25.0,
        availability_status: 'AVAILABLE',
        certification_status: 'PENDING',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueryBuilder.first.mockResolvedValueOnce(null);
      mockQueryBuilder.returning.mockResolvedValueOnce([newProfile]);

      const result = await workerProfileService.createProfile('user-uuid', {
        full_name: 'New Worker',
        category_id: 'cat-uuid',
        hourly_rate: 25.0,
      });

      expect(result).toBeDefined();
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result.full_name).toBe('New Worker');
      expect(result.hourly_rate).toBe(25.0);
    });

    it('should persist the 4 identity fields and leave worker specifics null', async () => {
      const newProfile = {
        id: 'new-profile-uuid',
        user_id: 'user-uuid',
        full_name: 'New Worker',
        date_of_birth: '1990-05-14',
        avatar_url: '/uploads/profiles/avatar.jpg',
        dni_front_url: '/uploads/profiles/front.jpg',
        dni_back_url: '/uploads/profiles/back.jpg',
        category_id: null,
        hourly_rate: null,
        availability_status: 'AVAILABLE',
        certification_status: 'PENDING',
      };

      mockQueryBuilder.first.mockResolvedValueOnce(null);
      mockQueryBuilder.returning.mockResolvedValueOnce([newProfile]);

      const result = await workerProfileService.createProfile('user-uuid', {
        full_name: 'New Worker',
        date_of_birth: '1990-05-14',
        avatar_url: '/uploads/profiles/avatar.jpg',
        dni_front_url: '/uploads/profiles/front.jpg',
        dni_back_url: '/uploads/profiles/back.jpg',
      });

      const inserted = mockQueryBuilder.insert.mock.calls[0][0];
      expect(inserted.date_of_birth).toBe('1990-05-14');
      expect(inserted.avatar_url).toBe('/uploads/profiles/avatar.jpg');
      expect(inserted.dni_front_url).toBe('/uploads/profiles/front.jpg');
      expect(inserted.dni_back_url).toBe('/uploads/profiles/back.jpg');
      // La categoría y la tarifa se definen en un flujo posterior, no en el alta.
      expect(inserted.category_id).toBeNull();
      expect(inserted.hourly_rate).toBeNull();
      expect(result.date_of_birth).toBe('1990-05-14');
      expect(result.hourly_rate).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should return null if profile does not exist', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await workerProfileService.updateProfile('user-uuid', {
        hourly_rate: 30.0,
      });

      expect(result).toBeNull();
    });

    it('should update existing profile fields', async () => {
      const existingProfile = {
        id: 'profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Old Name',
        avatar_url: null,
        bio: 'Old bio',
        category_id: 'old-cat',
        hourly_rate: 20.0,
        availability_status: 'AVAILABLE',
        certification_status: 'PENDING',
        updated_at: new Date(),
      };

      const updatedProfile = {
        ...existingProfile,
        hourly_rate: 40.0,
        availability_status: 'BUSY',
        bio: 'Updated bio',
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce(existingProfile)
        .mockResolvedValueOnce(updatedProfile);

      const result = await workerProfileService.updateProfile('user-uuid', {
        hourly_rate: 40.0,
        availability_status: 'BUSY',
        bio: 'Updated bio',
      });

      expect(result).toBeDefined();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(result.hourly_rate).toBe(40.0);
      expect(result.availability_status).toBe('BUSY');
    });
  });
});

describe('Worker Profile Validation Schema', () => {
  // El alta de perfil es universal: exige los mismos 4 datos de identidad que el
  // perfil de cliente y deja categoría, tarifa y disponibilidad para un flujo posterior.
  const identity = {
    date_of_birth: '1988-11-02',
    avatar_url: '/uploads/profiles/6f1c9a2e-0d1b-4c7a-9f3e-2b8d5a4c1e77.jpg',
    dni_front_url: '/uploads/profiles/1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.jpg',
    dni_back_url: '/uploads/profiles/9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a.jpg',
  };
  const workerExtras = {
    category_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    hourly_rate: 35.5,
  };

  describe('createWorkerProfileSchema', () => {
    it('should accept valid profile data', () => {
      const { error } = createWorkerProfileSchema.validate({
        full_name: 'Carlos García',
        ...identity,
        bio: 'Técnico reparador',
        ...workerExtras,
        availability_status: 'AVAILABLE',
      });
      expect(error).toBeUndefined();
    });

    it('should require the same 4 identity fields as the client profile', () => {
      for (const campo of Object.keys(identity)) {
        const payload = { full_name: 'Carlos García', ...identity, ...workerExtras };
        delete payload[campo];
        const { error } = createWorkerProfileSchema.validate(payload);
        expect(error).toBeDefined();
      }
    });

    it('should reject local file:// image URIs', () => {
      const { error } = createWorkerProfileSchema.validate({
        full_name: 'Carlos García',
        ...identity,
        ...workerExtras,
        dni_back_url: 'file:///data/user/0/com.app/files/dni_back.jpg',
      });
      expect(error).toBeDefined();
    });

    it('should accept a profile without category_id, hourly_rate nor availability_status', () => {
      const { error, value } = createWorkerProfileSchema.validate({
        full_name: 'Carlos García',
        ...identity,
      });
      expect(error).toBeUndefined();
      expect(value.category_id).toBeUndefined();
      expect(value.hourly_rate).toBeUndefined();
      expect(value.availability_status).toBeUndefined();
    });

    it('should reject empty full_name', () => {
      const { error } = createWorkerProfileSchema.validate({
        full_name: '',
        ...identity,
        ...workerExtras,
      });
      expect(error).toBeDefined();
    });

    it('should reject zero hourly_rate', () => {
      const { error } = createWorkerProfileSchema.validate({
        full_name: 'Test',
        ...identity,
        ...workerExtras,
        hourly_rate: 0,
      });
      expect(error).toBeDefined();
    });

    it('should reject negative hourly_rate', () => {
      const { error } = createWorkerProfileSchema.validate({
        full_name: 'Test',
        ...identity,
        ...workerExtras,
        hourly_rate: -10,
      });
      expect(error).toBeDefined();
    });

    it('should reject invalid availability_status', () => {
      const { error } = createWorkerProfileSchema.validate({
        full_name: 'Test',
        ...identity,
        ...workerExtras,
        availability_status: 'INVALID',
      });
      expect(error).toBeDefined();
    });

    it('should reject bio over 500 characters', () => {
      const { error } = createWorkerProfileSchema.validate({
        full_name: 'Test',
        ...identity,
        ...workerExtras,
        bio: 'x'.repeat(501),
      });
      expect(error).toBeDefined();
    });

    it('should reject non-JPG avatar URL', () => {
      const { error } = createWorkerProfileSchema.validate({
        full_name: 'Test',
        ...identity,
        ...workerExtras,
        avatar_url: 'https://example.com/file.gif',
      });
      expect(error).toBeDefined();
    });
  });

  describe('updateWorkerProfileSchema', () => {
    it('should accept partial update with hourly_rate only', () => {
      const { error } = updateWorkerProfileSchema.validate({
        hourly_rate: 40.0,
      });
      expect(error).toBeUndefined();
    });

    it('should accept partial update with availability_status only', () => {
      const { error } = updateWorkerProfileSchema.validate({
        availability_status: 'BUSY',
      });
      expect(error).toBeUndefined();
    });

    it('should accept partial update with category_id only', () => {
      const { error } = updateWorkerProfileSchema.validate({
        category_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });
      expect(error).toBeUndefined();
    });

    it('should reject empty body', () => {
      const { error } = updateWorkerProfileSchema.validate({});
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('al menos un campo');
    });

    it('should accept full update', () => {
      const { error } = updateWorkerProfileSchema.validate({
        full_name: 'Updated Name',
        avatar_url: 'https://example.com/new.jpg',
        bio: 'New bio',
        category_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        hourly_rate: 50.0,
        availability_status: 'OFFLINE',
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid hourly_rate', () => {
      const { error } = updateWorkerProfileSchema.validate({
        hourly_rate: -5,
      });
      expect(error).toBeDefined();
    });
  });
});

describe('Worker Profile Controller', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.orWhere.mockReset().mockReturnThis();
    mockQueryBuilder.insert.mockReset().mockReturnThis();
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.del.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.returning.mockReset().mockResolvedValue([1]);
    mockQueryBuilder.select.mockReset().mockReturnThis();
    mockQueryBuilder.avg.mockReset().mockReturnThis();
    mockQueryBuilder.leftJoin.mockReset().mockReturnThis();
  });

  describe('getProfile', () => {
    it('should return 403 when user tries to access another profile', async () => {
      const req = {
        params: { id: 'other-user' },
        user: { user_id: 'current-user' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await workerProfileController.getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 when profile does not exist', async () => {
      const req = {
        params: { id: 'same-user' },
        user: { user_id: 'same-user' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await workerProfileController.getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createProfile', () => {
    it('should return 403 when user tries to create another profile', async () => {
      const req = {
        params: { id: 'other-user' },
        user: { user_id: 'current-user' },
        body: { full_name: 'Test', category_id: 'cat-uuid', hourly_rate: 25 },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await workerProfileController.createProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 for validation error', async () => {
      const req = {
        params: { id: 'same-user' },
        user: { user_id: 'same-user' },
        body: { full_name: '' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await workerProfileController.createProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateProfile', () => {
    it('should return 403 when user tries to update another profile', async () => {
      const req = {
        params: { id: 'other-user' },
        user: { user_id: 'current-user' },
        body: { hourly_rate: 30 },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await workerProfileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 when profile does not exist for update', async () => {
      const req = {
        params: { id: 'same-user' },
        user: { user_id: 'same-user' },
        body: { hourly_rate: 30 },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await workerProfileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
