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

const { default: clientProfileService } = await import('../src/services/ClientProfileService.js');
const { default: clientProfileController } =
  await import('../src/controllers/ClientProfileController.js');
const { createClientProfileSchema, updateClientProfileSchema } =
  await import('../src/utils/validation.js');

describe('Client Profile Service', () => {
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
  });

  describe('getProfile', () => {
    it('should return null when profile does not exist', async () => {
      const result = await clientProfileService.getProfile('nonexistent-uuid');
      expect(result).toBeNull();
    });

    it('should return profile data when it exists', async () => {
      const mockProfile = {
        id: 'profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Juan Pérez',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Cliente desde 2024',
        default_location_id: 'loc-uuid',
        preferences: { notifications: true, language: 'es' },
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueryBuilder.first.mockResolvedValue(mockProfile);

      const result = await clientProfileService.getProfile('user-uuid');

      expect(result).toBeDefined();
      expect(result.full_name).toBe('Juan Pérez');
      expect(result.preferences.language).toBe('es');
      expect(result.default_location_id).toBe('loc-uuid');
    });
  });

  describe('createProfile', () => {
    it('should return null if profile already exists', async () => {
      mockQueryBuilder.first.mockResolvedValue({ id: 'existing' });

      const result = await clientProfileService.createProfile('user-uuid', {
        full_name: 'Test',
      });

      expect(result).toBeNull();
    });

    it('should create a new profile and return it', async () => {
      const newProfile = {
        id: 'new-profile-uuid',
        user_id: 'user-uuid',
        full_name: 'New Client',
        avatar_url: null,
        bio: null,
        default_location_id: null,
        preferences: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueryBuilder.first.mockResolvedValueOnce(null);
      mockQueryBuilder.returning.mockResolvedValueOnce([newProfile]);

      const result = await clientProfileService.createProfile('user-uuid', {
        full_name: 'New Client',
      });

      expect(result).toBeDefined();
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result.full_name).toBe('New Client');
    });
  });

  describe('updateProfile', () => {
    it('should return null if profile does not exist', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await clientProfileService.updateProfile('user-uuid', {
        full_name: 'Updated',
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
        default_location_id: null,
        preferences: null,
        updated_at: new Date(),
      };

      const updatedProfile = {
        ...existingProfile,
        full_name: 'Updated Name',
        bio: 'Updated bio',
        preferences: { theme: 'dark' },
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce(existingProfile)
        .mockResolvedValueOnce(updatedProfile);

      const result = await clientProfileService.updateProfile('user-uuid', {
        full_name: 'Updated Name',
        bio: 'Updated bio',
        preferences: { theme: 'dark' },
      });

      expect(result).toBeDefined();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(result.full_name).toBe('Updated Name');
    });
  });
});

describe('Client Profile Validation Schema', () => {
  describe('createClientProfileSchema', () => {
    it('should accept valid profile data', () => {
      const { error } = createClientProfileSchema.validate({
        full_name: 'Juan Pérez',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Cliente',
        default_location_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        preferences: { notifications: true },
      });
      expect(error).toBeUndefined();
    });

    it('should reject empty full_name', () => {
      const { error } = createClientProfileSchema.validate({
        full_name: '',
      });
      expect(error).toBeDefined();
    });

    it('should reject bio over 500 characters', () => {
      const { error } = createClientProfileSchema.validate({
        full_name: 'Test',
        bio: 'x'.repeat(501),
      });
      expect(error).toBeDefined();
    });

    it('should reject non-JPG avatar URL', () => {
      const { error } = createClientProfileSchema.validate({
        full_name: 'Test',
        avatar_url: 'https://example.com/file.gif',
      });
      expect(error).toBeDefined();
    });

    it('should accept null preferences', () => {
      const { error } = createClientProfileSchema.validate({
        full_name: 'Test',
        preferences: null,
      });
      expect(error).toBeUndefined();
    });

    it('should reject invalid UUID for default_location_id', () => {
      const { error } = createClientProfileSchema.validate({
        full_name: 'Test',
        default_location_id: 'not-a-uuid',
      });
      expect(error).toBeDefined();
    });
  });

  describe('updateClientProfileSchema', () => {
    it('should accept partial update', () => {
      const { error } = updateClientProfileSchema.validate({
        bio: 'Updated bio only',
      });
      expect(error).toBeUndefined();
    });

    it('should reject empty body', () => {
      const { error } = updateClientProfileSchema.validate({});
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('al menos un campo');
    });

    it('should accept full update', () => {
      const { error } = updateClientProfileSchema.validate({
        full_name: 'Updated Name',
        avatar_url: 'https://example.com/new.jpg',
        bio: 'New bio',
        default_location_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        preferences: { theme: 'dark', lang: 'en' },
      });
      expect(error).toBeUndefined();
    });
  });
});

describe('Client Profile Controller', () => {
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

      await clientProfileController.getProfile(req, res, next);

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

      await clientProfileController.getProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('createProfile', () => {
    it('should return 403 when user tries to create another profile', async () => {
      const req = {
        params: { id: 'other-user' },
        user: { user_id: 'current-user' },
        body: { full_name: 'Test' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await clientProfileController.createProfile(req, res, next);

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

      await clientProfileController.createProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updateProfile', () => {
    it('should return 403 when user tries to update another profile', async () => {
      const req = {
        params: { id: 'other-user' },
        user: { user_id: 'current-user' },
        body: { full_name: 'Hacker' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await clientProfileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 when profile does not exist for update', async () => {
      const req = {
        params: { id: 'same-user' },
        user: { user_id: 'same-user' },
        body: { full_name: 'Updated' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await clientProfileController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
