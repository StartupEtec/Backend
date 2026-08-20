import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';

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
  transaction: jest.fn(async (callback) => {
    return callback(mockKnex);
  }),
});

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

const { default: securityConfigService } = await import('../src/services/SecurityConfigService.js');
const { default: securityConfigController } =
  await import('../src/controllers/SecurityConfigController.js');

describe('Security Config Flow Tests', () => {
  beforeEach(() => {
    mockQueryBuilder.where.mockReset().mockReturnThis();
    mockQueryBuilder.orWhere.mockReset().mockReturnThis();
    mockQueryBuilder.insert.mockReset().mockResolvedValue([1]);
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.del.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.returning.mockReset().mockReturnThis();
    mockKnex.transaction.mockClear();
  });

  describe('SecurityConfigService', () => {
    it('changePassword - should fail if user not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      const res = await securityConfigService.changePassword('uuid-1', {
        current_password: 'OldPassword1!',
        new_password: 'NewPassword1!',
      });
      expect(res.error).toBe('USER_NOT_FOUND');
    });

    it('changePassword - should fail if current password incorrect', async () => {
      const mockUser = { id: 'uuid-1', password_hash: await bcrypt.hash('realOldPass1!', 10) };
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const res = await securityConfigService.changePassword('uuid-1', {
        current_password: 'wrongOldPassword!',
        new_password: 'NewPassword1!',
      });
      expect(res.error).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('changePassword - should fail if new password is same as old', async () => {
      const hash = await bcrypt.hash('realOldPass1!', 10);
      const mockUser = { id: 'uuid-1', password_hash: hash };
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const res = await securityConfigService.changePassword('uuid-1', {
        current_password: 'realOldPass1!',
        new_password: 'realOldPass1!',
      });
      expect(res.error).toBe('SAME_PASSWORD');
    });

    it('changePassword - should succeed with valid password', async () => {
      const hash = await bcrypt.hash('realOldPass1!', 10);
      const mockUser = { id: 'uuid-1', password_hash: hash };
      mockQueryBuilder.first.mockResolvedValue(mockUser);

      const res = await securityConfigService.changePassword('uuid-1', {
        current_password: 'realOldPass1!',
        new_password: 'NewPassword1!',
      });
      expect(res.success).toBe(true);
    });

    it('initEmailChange - should fail if user not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      const res = await securityConfigService.initEmailChange('uuid-1', {
        new_email: 'new@test.com',
      });
      expect(res.error).toBe('USER_NOT_FOUND');
    });

    it('initEmailChange - should fail if email is same as current', async () => {
      const mockUser = { id: 'uuid-1', email: 'current@test.com' };
      mockQueryBuilder.first.mockResolvedValue(mockUser);
      const res = await securityConfigService.initEmailChange('uuid-1', {
        new_email: 'current@test.com',
      });
      expect(res.error).toBe('SAME_EMAIL');
    });

    it('initEmailChange - should fail if email is already taken', async () => {
      const mockUser = { id: 'uuid-1', email: 'current@test.com' };
      mockQueryBuilder.first.mockReturnValueOnce(mockUser); // user exists
      mockQueryBuilder.first.mockReturnValueOnce({ id: 'uuid-2' }); // existing email owner

      const res = await securityConfigService.initEmailChange('uuid-1', {
        new_email: 'taken@test.com',
      });
      expect(res.error).toBe('EMAIL_ALREADY_TAKEN');
    });

    it('initEmailChange - should insert pending change and return success', async () => {
      const mockUser = { id: 'uuid-1', email: 'current@test.com' };
      mockQueryBuilder.first.mockReturnValueOnce(mockUser); // user exists
      mockQueryBuilder.first.mockReturnValueOnce(null); // email free

      const res = await securityConfigService.initEmailChange('uuid-1', {
        new_email: 'new@test.com',
      });
      expect(res.success).toBe(true);
    });

    it('verifyEmailChange - should fail if no pending change', async () => {
      const mockUser = { id: 'uuid-1', email: 'current@test.com' };
      mockQueryBuilder.first.mockReturnValueOnce(mockUser); // user exists
      mockQueryBuilder.first.mockReturnValueOnce(null); // no pending change

      const res = await securityConfigService.verifyEmailChange('uuid-1', {
        current_otp_code: '123456',
        new_otp_code: '654321',
      });
      expect(res.error).toBe('NO_PENDING_CHANGE');
    });

    it('verifyEmailChange - should fail if OTP expired', async () => {
      const mockUser = { id: 'uuid-1', email: 'current@test.com' };
      mockQueryBuilder.first.mockReturnValueOnce(mockUser); // user exists
      mockQueryBuilder.first.mockReturnValueOnce({
        id: 'pending-id',
        expires_at: new Date(Date.now() - 1000), // expired
      });

      const res = await securityConfigService.verifyEmailChange('uuid-1', {
        current_otp_code: '123456',
        new_otp_code: '654321',
      });
      expect(res.error).toBe('OTP_EXPIRED');
    });

    it('verifyEmailChange - should fail if OTPs do not match', async () => {
      const mockUser = { id: 'uuid-1', email: 'current@test.com' };
      mockQueryBuilder.first.mockReturnValueOnce(mockUser); // user exists
      mockQueryBuilder.first.mockReturnValueOnce({
        id: 'pending-id',
        current_otp_code: '111111',
        new_otp_code: '222222',
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      });

      const res = await securityConfigService.verifyEmailChange('uuid-1', {
        current_otp_code: '123456',
        new_otp_code: '654321',
      });
      expect(res.error).toBe('INVALID_OTP');
    });

    it('verifyEmailChange - should succeed with valid OTPs and update user email', async () => {
      const mockUser = { id: 'uuid-1', email: 'current@test.com' };
      mockQueryBuilder.first.mockReturnValueOnce(mockUser); // user exists
      mockQueryBuilder.first.mockReturnValueOnce({
        id: 'pending-id',
        new_value: 'new@test.com',
        current_otp_code: '123456',
        new_otp_code: '654321',
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      }); // pending change
      mockQueryBuilder.first.mockReturnValueOnce(null); // email still free

      const res = await securityConfigService.verifyEmailChange('uuid-1', {
        current_otp_code: '123456',
        new_otp_code: '654321',
      });
      expect(res.success).toBe(true);
      expect(res.new_email).toBe('new@test.com');
    });

    it('initPhoneChange - should insert pending change and return success', async () => {
      const mockUser = { id: 'uuid-1', phone: '3001111111' };
      mockQueryBuilder.first.mockReturnValueOnce(mockUser); // user exists
      mockQueryBuilder.first.mockReturnValueOnce(null); // phone free

      const res = await securityConfigService.initPhoneChange('uuid-1', {
        new_phone: '3002222222',
      });
      expect(res.success).toBe(true);
    });

    it('verifyPhoneChange - should succeed with valid OTPs and update user phone', async () => {
      const mockUser = { id: 'uuid-1', phone: '3001111111' };
      mockQueryBuilder.first.mockReturnValueOnce(mockUser); // user exists
      mockQueryBuilder.first.mockReturnValueOnce({
        id: 'pending-id',
        new_value: '3002222222',
        current_otp_code: '123456',
        new_otp_code: '654321',
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
      }); // pending change
      mockQueryBuilder.first.mockReturnValueOnce(null); // phone still free

      const res = await securityConfigService.verifyPhoneChange('uuid-1', {
        current_otp_code: '123456',
        new_otp_code: '654321',
      });
      expect(res.success).toBe(true);
      expect(res.new_phone).toBe('3002222222');
    });
  });

  describe('SecurityConfigController', () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        params: { id: 'uuid-1' },
        user: { user_id: 'uuid-1' },
        body: {},
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('changePassword - should return 403 if id does not match req.user.user_id', async () => {
      req.user.user_id = 'uuid-other';
      await securityConfigController.changePassword(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'FORBIDDEN' }));
    });

    it('changePassword - should return 400 on Joi validation error', async () => {
      req.body = { current_password: '', new_password: 'invalid' };
      await securityConfigController.changePassword(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'VALIDATION_ERROR' }));
    });

    it('changePassword - should return 200 on success', async () => {
      req.body = { current_password: 'OldPassword1!', new_password: 'NewPassword1!' };
      // Stub service call
      jest.spyOn(securityConfigService, 'changePassword').mockResolvedValue({ success: true });

      await securityConfigController.changePassword(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Contraseña actualizada correctamente' }),
      );
    });

    it('changeEmail - should return 200 on successful init', async () => {
      req.body = { new_email: 'new@test.com' };
      jest.spyOn(securityConfigService, 'initEmailChange').mockResolvedValue({ success: true });

      await securityConfigController.changeEmail(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    it('verifyEmailChange - should return 200 on successful verify', async () => {
      req.body = { current_otp_code: '123456', new_otp_code: '654321' };
      jest.spyOn(securityConfigService, 'verifyEmailChange').mockResolvedValue({
        success: true,
        new_email: 'new@test.com',
      });

      await securityConfigController.verifyEmailChange(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ email: 'new@test.com' }));
    });

    it('changePhone - should return 200 on successful init', async () => {
      req.body = { new_phone: '3002222222' };
      jest.spyOn(securityConfigService, 'initPhoneChange').mockResolvedValue({ success: true });

      await securityConfigController.changePhone(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });

    it('verifyPhoneChange - should return 200 on successful verify', async () => {
      req.body = { current_otp_code: '123456', new_otp_code: '654321' };
      jest.spyOn(securityConfigService, 'verifyPhoneChange').mockResolvedValue({
        success: true,
        new_phone: '3002222222',
      });

      await securityConfigController.verifyPhoneChange(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ phone: '3002222222' }));
    });
  });
});
