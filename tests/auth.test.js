import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';

// ---------------------------------------------------------------------------
// Shared query builder mock — all chainable methods are jest.fn() so we can
// assert on them in tests.
// ---------------------------------------------------------------------------
const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  insert: jest.fn().mockResolvedValue([1]),
  update: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  first: jest.fn().mockResolvedValue(null),
  returning: jest.fn().mockReturnThis(),
};

// IMPORTANT: mockKnex must be a plain function, NOT jest.fn().
// In Jest's ESM VM module sandbox, jest.fn() loses its configured implementation
// when accessed from other modules via the mock factory, causing db() → undefined.
// A plain arrow function always returns mockQueryBuilder reliably.
const mockKnex = Object.assign(() => mockQueryBuilder, {
  schema: {
    alterTable: jest.fn(),
    createTable: jest.fn(),
    dropTableIfExists: jest.fn(),
  },
  fn: { now: () => new Date() },
  raw: (val) => val,
});

// Mock the database module. In ESM, unstable_mockModule intercepts at the module
// resolution level, so a single mock covers ALL relative-path variations that
// resolve to the same absolute path (e.g. ../src/database/db.js from tests/
// and ../database/db.js from src/services/OtpService.js).
jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

// Dynamically import the files under test so they get the mocked database
const { default: authService } = await import('../src/services/AuthService.js');
const { default: otpService } = await import('../src/services/OtpService.js');
const { authenticateToken, requireRole } = await import('../src/middlewares/authMiddleware.js');

describe('Auth Services & Middlewares Tests', () => {
  beforeEach(() => {
    // Reset each mock to safe defaults before every test so state doesn't leak
    // between tests. We do NOT use jest.clearAllMocks() because in ESM mode
    // it also clears the mockReturnThis() implementations set during declaration.
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.orWhere.mockReset().mockReturnThis();
    mockQueryBuilder.insert.mockReset().mockResolvedValue([1]);
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.del.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.returning.mockReset().mockReturnThis();
  });

  describe('Password Hashing & Matching', () => {
    it('should correctly hash and match a password using bcrypt', async () => {
      const password = 'StrongPassword123!';
      const hash = await bcrypt.hash(password, 10);
      const isMatch = await bcrypt.compare(password, hash);
      expect(isMatch).toBe(true);
    });

    it('should reject a wrong password', async () => {
      const hash = await bcrypt.hash('Correct1!', 10);
      const isMatch = await bcrypt.compare('Wrong1!', hash);
      expect(isMatch).toBe(false);
    });
  });

  describe('JWT Token Service', () => {
    it('should generate a valid JWT access token and verify it', () => {
      const user = { id: 'user-uuid', email: 'test@example.com', current_role: 'client' };
      const token = authService.generateAccessToken(user);
      expect(token).toBeDefined();

      const decoded = authService.verifyAccessToken(token);
      expect(decoded.user_id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.current_role).toBe(user.current_role);
    });

    it('should return null for an invalid or tampered token', () => {
      const result = authService.verifyAccessToken('invalid.token.here');
      expect(result).toBeNull();
    });

    it('should generate a refresh token and store it in the DB', async () => {
      const token = await authService.generateRefreshToken('user-uuid');
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-uuid',
          jti: expect.any(String),
          expires_at: expect.any(Date),
        }),
      );
    });
  });

  describe('OTP Service', () => {
    it('should generate a 6 digit OTP and save it in the user record', async () => {
      const otp = await otpService.generateAndSaveOtp('user-uuid');
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith({ id: 'user-uuid' });
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          otp_code: otp,
          otp_expires_at: expect.any(Date),
          otp_failed_attempts: 0,
        }),
      );
    });

    it('should verify a valid OTP, clear it and mark the user as verified', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '12345678',
        otp_code: '999999',
        otp_expires_at: new Date(Date.now() + 50000),
        otp_failed_attempts: 1,
      };
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const result = await otpService.verifyOtp('test@example.com', '999999');
      expect(result.valid).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.user.id).toBe('user-uuid');
      // OTP should be cleared, user marked as verified and attempts reset
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          otp_code: null,
          otp_expires_at: null,
          is_verified: true,
          otp_failed_attempts: 0,
        }),
      );
    });

    it('should report EXPIRED when the OTP is expired', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '12345678',
        otp_code: '999999',
        otp_expires_at: new Date(Date.now() - 50000), // in the past
        otp_failed_attempts: 0,
      };
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const result = await otpService.verifyOtp('test@example.com', '999999');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('EXPIRED');
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('should report INVALID and count the attempt when the code does not match', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '12345678',
        otp_code: '111111',
        otp_expires_at: new Date(Date.now() + 50000),
        otp_failed_attempts: 0,
      };
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const result = await otpService.verifyOtp('test@example.com', '999999');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('INVALID');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ otp_failed_attempts: 1 }),
      );
    });

    it('should report NOT_FOUND when no user matches', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      const result = await otpService.verifyOtp('notfound@example.com', '123456');
      expect(result.valid).toBe(false);
      expect(result.user).toBeNull();
      expect(result.reason).toBe('NOT_FOUND');
    });

    it('should invalidate the OTP after reaching the max attempts', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '12345678',
        otp_code: '111111',
        otp_expires_at: new Date(Date.now() + 50000),
        otp_failed_attempts: 4, // 5th attempt is the last one
      };
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const result = await otpService.verifyOtp('test@example.com', '999999');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('ATTEMPTS_EXCEEDED');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          otp_code: null,
          otp_expires_at: null,
          otp_failed_attempts: 5,
        }),
      );
    });

    it('should keep reporting ATTEMPTS_EXCEEDED once the code is invalidated', async () => {
      const mockUser = {
        id: 'user-uuid',
        email: 'test@example.com',
        phone: '12345678',
        otp_code: null,
        otp_expires_at: null,
        otp_failed_attempts: 5,
      };
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const result = await otpService.verifyOtp('test@example.com', '999999');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('ATTEMPTS_EXCEEDED');
      expect(mockQueryBuilder.where).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });
  });

  describe('Auth Middlewares', () => {
    it('should pass authenticateToken with a valid JWT', () => {
      const req = {
        headers: {
          authorization: `Bearer ${authService.generateAccessToken({ id: '123', email: 'a@b.com', current_role: 'client' })}`,
        },
      };
      const res = {};
      const next = jest.fn();

      authenticateToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.current_role).toBe('client');
      expect(req.user.user_id).toBe('123');
    });

    it('should reject authenticateToken when no token is provided', () => {
      const req = { headers: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authenticateToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject authenticateToken with an invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid.token' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authenticateToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should authorize access with the correct role', () => {
      const req = {
        user: { user_id: '123', email: 'a@b.com', current_role: 'provider' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      const middleware = requireRole(['provider']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should deny access if role does not match', () => {
      const req = {
        user: { user_id: '123', email: 'a@b.com', current_role: 'client' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      const middleware = requireRole(['provider']);
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should treat worker and provider as equivalent roles', () => {
      const req = {
        user: { user_id: '123', email: 'a@b.com', current_role: 'worker' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      const middleware = requireRole(['provider']);
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
