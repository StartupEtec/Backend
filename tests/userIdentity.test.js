import { jest } from '@jest/globals';

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
  first: jest.fn().mockResolvedValue(null),
  returning: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
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

const { default: userService } = await import('../src/services/UserService.js');
const { createIdentitySchema, updateIdentitySchema } = await import('../src/utils/validation.js');

describe('User Identity (perfil único)', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.insert.mockReset().mockResolvedValue([1]);
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.returning.mockReset().mockReturnThis();
    mockQueryBuilder.select.mockReset().mockReturnThis();
  });

  describe('getIdentity', () => {
    it('returns null when user does not exist', async () => {
      const result = await userService.getIdentity('missing');
      expect(result).toBeNull();
    });

    it('returns partial identity with is_complete:false (precarga)', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce({
        id: 'u1',
        full_name: 'Juan',
        date_of_birth: null,
        avatar_url: '/uploads/a.jpg',
        dni_front_url: null,
        dni_back_url: null,
      });

      const result = await userService.getIdentity('u1');

      expect(result.full_name).toBe('Juan');
      expect(result.avatar_url).toBe('/uploads/a.jpg');
      expect(result.date_of_birth).toBeNull();
      expect(result.is_complete).toBe(false);
    });

    it('returns is_complete:true when all fields present', async () => {
      mockQueryBuilder.first.mockResolvedValueOnce({
        id: 'u1',
        full_name: 'Juan',
        date_of_birth: new Date(1990, 4, 14),
        avatar_url: '/uploads/a.jpg',
        dni_front_url: '/uploads/f.jpg',
        dni_back_url: '/uploads/b.jpg',
      });

      const result = await userService.getIdentity('u1');

      expect(result.date_of_birth).toBe('1990-05-14');
      expect(result.is_complete).toBe(true);
    });
  });

  describe('upsertIdentity', () => {
    it('returns null when user does not exist', async () => {
      const result = await userService.upsertIdentity('missing', {
        full_name: 'Juan',
      });
      expect(result).toBeNull();
    });

    it('syncs both role profiles when identity becomes complete', async () => {
      const complete = {
        id: 'u1',
        full_name: 'Juan',
        date_of_birth: '1990-05-14',
        avatar_url: '/uploads/a.jpg',
        dni_front_url: '/uploads/f.jpg',
        dni_back_url: '/uploads/b.jpg',
      };
      mockQueryBuilder.first
        .mockResolvedValueOnce({ id: 'u1' })
        .mockResolvedValueOnce(complete)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ user_id: 'u1' });

      const result = await userService.upsertIdentity('u1', {
        full_name: 'Juan',
        date_of_birth: '1990-05-14',
        avatar_url: '/uploads/a.jpg',
        dni_front_url: '/uploads/f.jpg',
        dni_back_url: '/uploads/b.jpg',
      });

      expect(result.is_complete).toBe(true);
      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('identity validation schemas', () => {
    const full = {
      full_name: 'Juan',
      date_of_birth: '1990-05-14',
      avatar_url: '/uploads/a.jpg',
      dni_front_url: '/uploads/f.jpg',
      dni_back_url: '/uploads/b.jpg',
    };

    it('create requires all identity fields and rejects local URIs', () => {
      expect(createIdentitySchema.validate(full).error).toBeUndefined();
      const bad = createIdentitySchema.validate({ ...full, avatar_url: 'file:///a.jpg' });
      expect(bad.error).toBeDefined();
      const missing = createIdentitySchema.validate({ full_name: 'Juan' });
      expect(missing.error).toBeDefined();
    });

    it('update allows partial payloads', () => {
      expect(updateIdentitySchema.validate({ full_name: 'Ana' }).error).toBeUndefined();
      expect(updateIdentitySchema.validate({}).error).toBeDefined();
    });
  });
});
