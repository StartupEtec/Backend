import { jest } from '@jest/globals';

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  first: jest.fn().mockResolvedValue(null),
  returning: jest.fn().mockReturnThis(),
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

const mockGenerateAccessToken = jest.fn();

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));
jest.unstable_mockModule('../src/services/AuthService.js', () => ({
  default: { generateAccessToken: mockGenerateAccessToken },
}));

const { default: userService } = await import('../src/services/UserService.js');
const { default: userController } = await import('../src/controllers/UserController.js');
const { updateProfileSchema, switchRoleSchema } = await import('../src/utils/validation.js');

describe('User Profile Service', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.orWhere.mockReset().mockReturnThis();
    mockQueryBuilder.insert.mockReset().mockResolvedValue([1]);
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.del.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.returning.mockReset().mockReturnThis();
    mockQueryBuilder.select.mockReset().mockReturnThis();
    mockQueryBuilder.avg.mockReset().mockReturnThis();
  });

  describe('getPublicProfile', () => {
    it('should return null when user does not exist', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await userService.getPublicProfile('nonexistent-uuid');
      expect(result).toBeNull();
    });

    it('should return public profile for a client user', async () => {
      const mockUser = { id: 'user-uuid', email: 'test@example.com' };
      const mockProfile = {
        id: 'profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Juan Pérez',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Client bio',
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockProfile)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const result = await userService.getPublicProfile('user-uuid');

      expect(result).toBeDefined();
      expect(result.id).toBe('user-uuid');
      expect(result.full_name).toBe('Juan Pérez');
      expect(result.avatar_url).toBe('https://example.com/avatar.jpg');
      expect(result.bio).toBe('Client bio');
      expect(result.role).toBe('client');
    });

    it('should return public profile for a worker user', async () => {
      const mockUser = { id: 'user-uuid', email: 'worker@example.com' };
      const mockProfile = {
        id: 'worker-profile-uuid',
        user_id: 'user-uuid',
        full_name: 'María García',
        avatar_url: 'https://example.com/worker.jpg',
        bio: 'Worker bio',
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockProfile)
        .mockResolvedValueOnce(null);

      const result = await userService.getPublicProfile('user-uuid');

      expect(result).toBeDefined();
      expect(result.full_name).toBe('María García');
      expect(result.role).toBe('worker');
    });

    it('should include average rating when available', async () => {
      const mockUser = { id: 'user-uuid', email: 'rated@example.com' };
      const mockProfile = {
        id: 'profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Rated User',
        avatar_url: null,
        bio: null,
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockProfile)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ average: 4.5 });

      const result = await userService.getPublicProfile('user-uuid');

      expect(result.average_rating).toBe('4.5');
    });
  });

  describe('getPrivateProfile', () => {
    it('should return null when user does not exist', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await userService.getPrivateProfile('nonexistent-uuid');
      expect(result).toBeNull();
    });

    it('should return full private profile with both client and worker profiles', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '3001234567',
        current_role: 'client',
        is_verified: true,
        verified_email: true,
        verified_phone: false,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockClientProfile = {
        id: 'client-profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Client Name',
        avatar_url: null,
        bio: 'Client bio',
      };

      const mockWorkerProfile = {
        id: 'worker-profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Worker Name',
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'Worker bio',
        hourly_rate: 25.5,
        availability_status: 'AVAILABLE',
        certification_status: 'APPROVED',
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockClientProfile)
        .mockResolvedValueOnce(mockWorkerProfile)
        .mockResolvedValueOnce({ average: 4.2 });

      const result = await userService.getPrivateProfile('user-uuid');

      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.phone).toBe('3001234567');
      expect(result.current_role).toBe('client');
      expect(result.average_rating).toBe('4.2');
      expect(result.profile.client).toBeDefined();
      expect(result.profile.client.full_name).toBe('Client Name');
      expect(result.profile.worker).toBeDefined();
      expect(result.profile.worker.full_name).toBe('Worker Name');
      expect(result.profile.worker.hourly_rate).toBe(25.5);
    });
  });

  describe('updateProfile', () => {
    it('should update existing profile', async () => {
      const existingProfile = {
        id: 'profile-uuid',
        user_id: 'user-uuid',
        full_name: 'Old Name',
        avatar_url: null,
        bio: 'Old bio',
        updated_at: new Date(),
      };

      const updatedProfile = {
        ...existingProfile,
        full_name: 'New Name',
        avatar_url: 'https://example.com/new.jpg',
        bio: 'New bio',
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce(existingProfile)
        .mockResolvedValueOnce(updatedProfile);

      const result = await userService.updateProfile(
        'user-uuid',
        {
          full_name: 'New Name',
          avatar_url: 'https://example.com/new.jpg',
          bio: 'New bio',
        },
        'client',
      );

      expect(result).toBeDefined();
      expect(mockQueryBuilder.update).toHaveBeenCalled();
      expect(result.full_name).toBe('New Name');
    });

    it('should create profile if it does not exist', async () => {
      const newProfile = {
        id: 'new-profile-uuid',
        user_id: 'user-uuid',
        full_name: 'New User',
        avatar_url: null,
        bio: null,
        updated_at: new Date(),
      };

      mockQueryBuilder.first.mockResolvedValueOnce(null).mockResolvedValueOnce(newProfile);

      const result = await userService.updateProfile(
        'user-uuid',
        { full_name: 'New User', avatar_url: null, bio: null },
        'worker',
      );

      expect(result).toBeDefined();
      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(result.full_name).toBe('New User');
    });
  });

  describe('switchRole', () => {
    it('should return error if user not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await userService.switchRole('nonexistent-uuid', 'worker');

      expect(result.error).toBe('USER_NOT_FOUND');
    });

    it('should return error if trying to switch to same role', async () => {
      mockQueryBuilder.first.mockResolvedValue({ id: 'user-uuid', current_role: 'client' });

      const result = await userService.switchRole('user-uuid', 'client');

      expect(result.error).toBe('SAME_ROLE');
    });

    it('should return error if client profile is missing', async () => {
      mockQueryBuilder.first
        .mockResolvedValueOnce({ id: 'user-uuid', current_role: 'worker' })
        .mockResolvedValueOnce(null);

      const result = await userService.switchRole('user-uuid', 'client');

      expect(result.error).toBe('MISSING_CLIENT_PROFILE');
    });

    it('should return error if worker profile is missing', async () => {
      const mockClientProfile = { id: 'client-uuid', user_id: 'user-uuid' };

      mockQueryBuilder.first
        .mockResolvedValueOnce({ id: 'user-uuid', current_role: 'client' })
        .mockResolvedValueOnce(mockClientProfile)
        .mockResolvedValueOnce(null);

      const result = await userService.switchRole('user-uuid', 'worker');

      expect(result.error).toBe('MISSING_WORKER_PROFILE');
    });

    it('should return error if worker certification is not approved', async () => {
      const mockClientProfile = { id: 'client-uuid', user_id: 'user-uuid' };
      const mockWorkerProfile = {
        id: 'worker-uuid',
        user_id: 'user-uuid',
        certification_status: 'PENDING',
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce({ id: 'user-uuid', current_role: 'client' })
        .mockResolvedValueOnce(mockClientProfile)
        .mockResolvedValueOnce(mockWorkerProfile);

      const result = await userService.switchRole('user-uuid', 'worker');

      expect(result.error).toBe('WORKER_NOT_CERTIFIED');
    });

    it('should switch role successfully from client to worker', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        current_role: 'client',
      };
      const mockClientProfile = { id: 'client-uuid', user_id: 'user-uuid' };
      const mockWorkerProfile = {
        id: 'worker-uuid',
        user_id: 'user-uuid',
        certification_status: 'APPROVED',
      };
      const mockUpdatedUser = {
        ...mockUser,
        current_role: 'worker',
        last_role: 'client',
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockClientProfile)
        .mockResolvedValueOnce(mockWorkerProfile)
        .mockResolvedValueOnce(mockUpdatedUser);

      const result = await userService.switchRole('user-uuid', 'worker');

      expect(result).toBeDefined();
      expect(result.user.current_role).toBe('worker');
      expect(result.user.last_role).toBe('client');
      expect(result.previousRole).toBe('client');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });

    it('should switch role successfully from worker to client', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        current_role: 'worker',
      };
      const mockClientProfile = { id: 'client-uuid', user_id: 'user-uuid' };
      const mockWorkerProfile = {
        id: 'worker-uuid',
        user_id: 'user-uuid',
        certification_status: 'APPROVED',
      };
      const mockUpdatedUser = {
        ...mockUser,
        current_role: 'client',
        last_role: 'worker',
      };

      mockQueryBuilder.first
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockClientProfile)
        .mockResolvedValueOnce(mockWorkerProfile)
        .mockResolvedValueOnce(mockUpdatedUser);

      const result = await userService.switchRole('user-uuid', 'client');

      expect(result).toBeDefined();
      expect(result.user.current_role).toBe('client');
      expect(result.user.last_role).toBe('worker');
      expect(mockQueryBuilder.update).toHaveBeenCalled();
    });
  });
});

describe('User Profile Validation Schema', () => {
  it('should accept valid profile data', () => {
    const { error } = updateProfileSchema.validate({
      full_name: 'Juan Pérez',
      avatar_url: 'https://example.com/avatar.jpg',
      bio: 'Una biografía corta',
    });
    expect(error).toBeUndefined();
  });

  it('should reject empty full_name', () => {
    const { error } = updateProfileSchema.validate({
      full_name: '',
      avatar_url: null,
      bio: null,
    });
    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('vacío');
  });

  it('should reject bio longer than 500 characters', () => {
    const { error } = updateProfileSchema.validate({
      full_name: 'Test User',
      avatar_url: null,
      bio: 'x'.repeat(501),
    });
    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('500');
  });

  it('should reject non-JPG/PNG avatar URL', () => {
    const { error } = updateProfileSchema.validate({
      full_name: 'Test User',
      avatar_url: 'https://example.com/image.gif',
      bio: null,
    });
    expect(error).toBeDefined();
    expect(error.details[0].message).toContain('JPG');
  });

  it('should allow null avatar_url and bio', () => {
    const { error } = updateProfileSchema.validate({
      full_name: 'Test User',
      avatar_url: null,
      bio: null,
    });
    expect(error).toBeUndefined();
  });

  it('should allow empty string avatar_url and bio', () => {
    const { error } = updateProfileSchema.validate({
      full_name: 'Test User',
      avatar_url: '',
      bio: '',
    });
    expect(error).toBeUndefined();
  });
});

describe('Switch Role Validation Schema', () => {
  it('should accept valid role client', () => {
    const { error } = switchRoleSchema.validate({ role: 'client' });
    expect(error).toBeUndefined();
  });

  it('should accept valid role worker', () => {
    const { error } = switchRoleSchema.validate({ role: 'worker' });
    expect(error).toBeUndefined();
  });

  it('should reject invalid role', () => {
    const { error } = switchRoleSchema.validate({ role: 'admin' });
    expect(error).toBeDefined();
  });

  it('should reject missing role', () => {
    const { error } = switchRoleSchema.validate({});
    expect(error).toBeDefined();
  });

  it('should reject empty role', () => {
    const { error } = switchRoleSchema.validate({ role: '' });
    expect(error).toBeDefined();
  });
});

describe('User Profile Controller', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.orWhere.mockReset().mockReturnThis();
    mockQueryBuilder.insert.mockReset().mockResolvedValue([1]);
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.del.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.returning.mockReset().mockReturnThis();
    mockQueryBuilder.select.mockReset().mockReturnThis();
    mockQueryBuilder.avg.mockReset().mockReturnThis();
  });

  describe('getUserById', () => {
    it('should return 404 when user not found', async () => {
      const req = { params: { id: 'nonexistent' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await userController.getUserById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'USER_NOT_FOUND' }));
    });
  });

  describe('getMyProfile', () => {
    it('should return 404 when user not found', async () => {
      const req = { user: { user_id: 'nonexistent' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await userController.getMyProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateProfile', () => {
    it('should return 403 when user tries to edit another profile', async () => {
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

      await userController.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'FORBIDDEN' }));
    });
  });

  describe('switchRole', () => {
    beforeEach(() => {
      mockGenerateAccessToken.mockReset();
    });

    it('should return 403 when user tries to switch role of another user', async () => {
      const req = {
        params: { id: 'other-user' },
        user: { user_id: 'current-user' },
        body: { role: 'worker' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await userController.switchRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'FORBIDDEN' }));
    });

    it('should return 400 for invalid role', async () => {
      const req = {
        params: { id: 'same-user' },
        user: { user_id: 'same-user' },
        body: { role: 'invalid' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      await userController.switchRole(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
    });
  });
});
