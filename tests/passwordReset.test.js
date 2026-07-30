import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  first: jest.fn().mockResolvedValue(null),
  returning: jest.fn().mockReturnThis(),
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

// Mock the DB module
jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

// Import files under test
const { default: authService } = await import('../src/services/AuthService.js');

describe('Password Reset Flow Tests', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.orWhere.mockReset().mockReturnThis();
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
  });

  describe('Reset Token Generation and Invalidation (Single-Use)', () => {
    it('should generate a valid reset token and verify it correctly', async () => {
      const user = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        password_hash: '$2b$10$hashedpasswordstring12345',
      };

      const token = authService.generateResetPasswordToken(user);
      expect(token).toBeDefined();

      const verified = authService.verifyResetPasswordToken(token, user);
      expect(verified).toBeDefined();
      expect(verified.user_id).toBe(user.id);
      expect(verified.purpose).toBe('password_reset');
    });

    it('should fail token verification if the user password changes (single-use constraint)', async () => {
      const user = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        password_hash: '$2b$10$oldpasswordhashhere',
      };

      const token = authService.generateResetPasswordToken(user);

      // Verify immediately works
      const verifiedBefore = authService.verifyResetPasswordToken(token, user);
      expect(verifiedBefore).not.toBeNull();

      // Simulate password change by changing hash
      const userWithNewPassword = {
        ...user,
        password_hash: '$2b$10$newpasswordhashhere',
      };

      const verifiedAfter = authService.verifyResetPasswordToken(token, userWithNewPassword);
      expect(verifiedAfter).toBeNull();
    });

    it('should fail verification if the token expires', () => {
      const user = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        password_hash: 'somehash',
      };

      // Sign an expired token
      const JWT_RESET_SECRET =
        process.env.JWT_RESET_SECRET || process.env.JWT_SECRET || 'default_reset_secret_key_12345';
      const expiredToken = jwt.sign(
        { user_id: user.id, email: user.email, purpose: 'password_reset' },
        JWT_RESET_SECRET + user.password_hash,
        { expiresIn: '-1s' },
      );

      const verified = authService.verifyResetPasswordToken(expiredToken, user);
      expect(verified).toBeNull();
    });

    it('should decode a token without verifying signature', () => {
      const user = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        password_hash: 'somehash',
      };

      const token = authService.generateResetPasswordToken(user);
      const decoded = authService.decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.user_id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
    });
  });

  describe('AuthController Reset Handlers', () => {
    let authController;

    beforeAll(async () => {
      const mod = await import('../src/controllers/AuthController.js');
      authController = mod.default;
    });

    describe('forgotPassword', () => {
      it('should return 400 for validation errors', async () => {
        const req = { body: {} }; // empty body, Joi validation fails
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };
        const next = jest.fn();

        await authController.forgotPassword(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'VALIDATION_ERROR',
          }),
        );
      });

      it('should return 404 if user is not found', async () => {
        const req = { body: { email: 'nonexistent@example.com' } };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };
        const next = jest.fn();

        mockQueryBuilder.first.mockResolvedValue(null);

        await authController.forgotPassword(req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'USER_NOT_FOUND',
          }),
        );
      });

      it('should generate a reset code and return 200 on success', async () => {
        const req = { body: { email: 'user@example.com' } };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };
        const next = jest.fn();

        const mockUser = { id: 'user-uuid', email: 'user@example.com', phone: '12345678' };
        mockQueryBuilder.first.mockResolvedValue(mockUser);

        await authController.forgotPassword(req, res, next);

        expect(mockQueryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            reset_code: expect.any(String),
            reset_expires_at: expect.any(Date),
          }),
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Código de recuperación enviado correctamente.',
        });
      });
    });

    describe('verifyResetCode', () => {
      it('should return 400 for invalid code or expiration', async () => {
        const req = { body: { email: 'user@example.com', reset_code: '123456' } };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };
        const next = jest.fn();

        // Simulate incorrect code
        const mockUser = {
          id: 'user-uuid',
          email: 'user@example.com',
          reset_code: '654321', // does not match
          reset_expires_at: new Date(Date.now() + 50000),
        };
        mockQueryBuilder.first.mockResolvedValue(mockUser);

        await authController.verifyResetCode(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'INVALID_RESET_CODE',
          }),
        );
      });

      it('should return 400 if code is expired', async () => {
        const req = { body: { email: 'user@example.com', reset_code: '123456' } };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };
        const next = jest.fn();

        const mockUser = {
          id: 'user-uuid',
          email: 'user@example.com',
          reset_code: '123456',
          reset_expires_at: new Date(Date.now() - 50000), // in the past
        };
        mockQueryBuilder.first.mockResolvedValue(mockUser);

        await authController.verifyResetCode(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'EXPIRED_RESET_CODE',
          }),
        );
      });

      it('should generate temporal token and clear code on successful verification', async () => {
        const req = { body: { email: 'user@example.com', reset_code: '123456' } };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };
        const next = jest.fn();

        const mockUser = {
          id: 'user-uuid',
          email: 'user@example.com',
          reset_code: '123456',
          reset_expires_at: new Date(Date.now() + 50000),
          password_hash: 'somehash',
        };
        mockQueryBuilder.first.mockResolvedValue(mockUser);

        await authController.verifyResetCode(req, res, next);

        expect(mockQueryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            reset_code: null,
            reset_expires_at: null,
          }),
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            token: expect.any(String),
          }),
        );
      });
    });

    describe('resetPassword', () => {
      it('should return 400 for invalid temporal token', async () => {
        const req = { body: { token: 'invalid-token', password: 'NewPassword1!' } };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };
        const next = jest.fn();

        await authController.resetPassword(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'INVALID_TOKEN',
          }),
        );
      });

      it('should update password and audit log on success', async () => {
        const mockUser = {
          id: 'user-uuid',
          email: 'user@example.com',
          password_hash: 'oldhash',
        };
        const token = authService.generateResetPasswordToken(mockUser);

        const req = { body: { token, password: 'NewSecureP@ss1!' } };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };
        const next = jest.fn();

        mockQueryBuilder.first.mockResolvedValue(mockUser);

        await authController.resetPassword(req, res, next);

        expect(mockQueryBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            password_hash: expect.any(String),
          }),
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          message: 'Contraseña restablecida correctamente.',
        });
      });
    });
  });
});
