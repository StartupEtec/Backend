import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key_12345';
const REFRESH_TOKEN_SECRET =
  process.env.REFRESH_TOKEN_SECRET || 'default_refresh_token_secret_key_12345';

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  first: jest.fn().mockResolvedValue(null),
  returning: jest.fn().mockReturnThis(),
};

// See tests/auth.test.js — the mock must be a plain function, not jest.fn().
const mockKnex = Object.assign(() => mockQueryBuilder, {
  fn: { now: () => new Date() },
  raw: (val) => val,
});

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

const { default: authService } = await import('../src/services/AuthService.js');

const signRefreshToken = (userId, jti) =>
  jwt.sign({ user_id: userId, jti }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

describe('AuthService — refresh, revoke, reset password y decode', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.insert.mockReset().mockResolvedValue([1]);
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.del.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.returning.mockReset().mockReturnThis();
  });

  describe('refreshAccessToken', () => {
    it('should rotate the token and return a new access + refresh token', async () => {
      const storedToken = {
        jti: 'jti-valid',
        expires_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      };
      const user = { id: 'user-uuid', email: 'a@b.com', current_role: 'client', active: true };
      mockQueryBuilder.first.mockResolvedValueOnce(storedToken).mockResolvedValueOnce(user);
      mockQueryBuilder.insert.mockResolvedValue([{ id: 1 }]);

      const result = await authService.refreshAccessToken(
        signRefreshToken('user-uuid', 'jti-valid'),
      );

      expect(result).not.toBeNull();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();

      const decodedAccess = jwt.verify(result.accessToken, JWT_SECRET);
      expect(decodedAccess.user_id).toBe('user-uuid');

      // Old refresh token revocado (token rotation)
      expect(mockQueryBuilder.del).toHaveBeenCalled();

      // Nuevo refresh token almacenado con el nuevo jti
      const insertCalls = mockQueryBuilder.insert.mock.calls;
      const refreshInsert = insertCalls.find(
        (call) => call[0] && call[0].jti !== 'jti-valid' && call[0].user_id === 'user-uuid',
      );
      expect(refreshInsert).toBeDefined();
    });

    it('should return null when the token is invalid or tampered', async () => {
      const result = await authService.refreshAccessToken('not.a.real.token');
      expect(result).toBeNull();
    });

    it('should return null when the stored token does not exist (revoked)', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      const result = await authService.refreshAccessToken(
        signRefreshToken('user-uuid', 'jti-ghost'),
      );
      expect(result).toBeNull();
    });

    it('should return null when the stored token is expired and delete it', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        jti: 'jti-old',
        expires_at: new Date(Date.now() - 60 * 60 * 1000),
      });

      const result = await authService.refreshAccessToken(signRefreshToken('user-uuid', 'jti-old'));
      expect(result).toBeNull();
      expect(mockQueryBuilder.del).toHaveBeenCalled();
    });

    it('should return null when the user is inactive', async () => {
      const storedToken = {
        jti: 'jti-inactive',
        expires_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      };
      mockQueryBuilder.first
        .mockResolvedValueOnce(storedToken)
        .mockResolvedValueOnce({ id: 'user-uuid', active: false });

      const result = await authService.refreshAccessToken(
        signRefreshToken('user-uuid', 'jti-inactive'),
      );
      expect(result).toBeNull();
    });

    it('should return null when the user no longer exists', async () => {
      const storedToken = {
        jti: 'jti-nouser',
        expires_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      };
      mockQueryBuilder.first.mockResolvedValueOnce(storedToken).mockResolvedValueOnce(null);

      const result = await authService.refreshAccessToken(
        signRefreshToken('user-uuid', 'jti-nouser'),
      );
      expect(result).toBeNull();
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke a valid token and return true', async () => {
      const result = await authService.revokeRefreshToken(
        signRefreshToken('user-uuid', 'jti-revoke'),
      );
      expect(result).toBe(true);
      expect(mockQueryBuilder.del).toHaveBeenCalled();
    });

    it('should return false for an invalid token', async () => {
      const result = await authService.revokeRefreshToken('garbage.token.string');
      expect(result).toBe(false);
    });
  });

  describe('reset password tokens', () => {
    const user = { id: 'user-uuid', email: 'a@b.com', password_hash: 'hash-123' };

    it('should generate and verify a reset token bound to the password hash', () => {
      const token = authService.generateResetPasswordToken(user);
      expect(token).toBeDefined();

      const decoded = authService.verifyResetPasswordToken(token, user);
      expect(decoded).not.toBeNull();
      expect(decoded.purpose).toBe('password_reset');
      expect(decoded.user_id).toBe('user-uuid');
    });

    it('should reject a token whose purpose is not password_reset', () => {
      const token = jwt.sign(
        { user_id: 'user-uuid', email: 'a@b.com', purpose: 'other' },
        JWT_SECRET + user.password_hash,
        {
          expiresIn: '10m',
        },
      );
      expect(authService.verifyResetPasswordToken(token, user)).toBeNull();
    });

    it('should reject a tampered token (different password hash)', () => {
      const token = authService.generateResetPasswordToken(user);
      expect(
        authService.verifyResetPasswordToken(token, { password_hash: 'different-hash' }),
      ).toBeNull();
    });

    it('should return null when the token signature is invalid', () => {
      expect(authService.verifyResetPasswordToken('not-a-token', user)).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid token', () => {
      const token = authService.generateAccessToken({
        id: 'user-uuid',
        email: 'a@b.com',
        current_role: 'client',
      });
      const decoded = authService.decodeToken(token);
      expect(decoded.user_id).toBe('user-uuid');
    });

    it('should return null when decoding fails', () => {
      jest.spyOn(jwt, 'decode').mockImplementationOnce(() => {
        throw new Error('invalid token');
      });
      expect(authService.decodeToken('anything')).toBeNull();
    });
  });

  describe('generateAccessToken', () => {
    it('should default current_role to client when missing', () => {
      const token = authService.generateAccessToken({ id: 'user-uuid', email: 'a@b.com' });
      const decoded = jwt.verify(token, JWT_SECRET);
      expect(decoded.current_role).toBe('client');
    });
  });
});
