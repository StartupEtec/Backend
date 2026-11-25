import { jest } from '@jest/globals';

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
  schema: { alterTable: jest.fn(), createTable: jest.fn(), dropTableIfExists: jest.fn() },
  fn: { now: () => new Date() },
  raw: (val) => val,
});

const mockOtpService = {
  generateAndSaveOtp: jest.fn().mockResolvedValue('123456'),
  sendOtp: jest.fn().mockResolvedValue(undefined),
  verifyOtp: jest.fn(),
};

const mockAuthService = {
  generateAccessToken: jest.fn().mockReturnValue('access-token'),
  generateRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
  revokeRefreshToken: jest.fn().mockResolvedValue(true),
};

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));
jest.unstable_mockModule('../src/services/OtpService.js', () => ({ default: mockOtpService }));
jest.unstable_mockModule('../src/services/AuthService.js', () => ({ default: mockAuthService }));

const { default: authController } = await import('../src/controllers/AuthController.js');

const makeRes = () => {
  const res = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
};

describe('AuthController — contrato de errores OTP y resend-otp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // resetMocks/clearMocks del jest config borran implementaciones antes de cada
    // test; volvemos a declarar los valores por defecto aquí.
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.orWhere.mockReturnThis();
    // .insert(...).returning(...) se encadenan; insert devuelve un objeto con returning
    mockQueryBuilder.insert.mockReset().mockImplementation(() => ({
      returning: jest.fn().mockResolvedValue([1]),
    }));
    mockQueryBuilder.update.mockReset().mockResolvedValue(1);
    mockQueryBuilder.first.mockReset().mockResolvedValue(null);
    mockQueryBuilder.returning.mockReturnThis();

    mockOtpService.generateAndSaveOtp.mockResolvedValue('123456');
    mockOtpService.sendOtp.mockResolvedValue(undefined);
    mockAuthService.generateAccessToken.mockReturnValue('access-token');
    mockAuthService.generateRefreshToken.mockResolvedValue('refresh-token');
    mockAuthService.revokeRefreshToken.mockResolvedValue(true);
  });

  describe('verifyOtp -> mapeo de razones a status HTTP', () => {
    it.each([
      ['NOT_FOUND', 400, 'INVALID_OTP'],
      ['INVALID', 400, 'INVALID_OTP'],
      ['EXPIRED', 410, 'EXPIRED_OTP'],
      ['ATTEMPTS_EXCEEDED', 429, 'OTP_ATTEMPTS_EXCEEDED'],
    ])('razón %s -> %i %s', async (reason, status, errorCode) => {
      mockOtpService.verifyOtp.mockResolvedValue({ valid: false, user: null, reason });

      const res = makeRes();
      await authController.verifyOtp(
        { body: { email: 'a@b.com', otp_code: '123456' } },
        res,
        () => {},
      );

      expect(res.statusCode).toBe(status);
      expect(res.body.error).toBe(errorCode);
      expect(mockAuthService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('otorga tokens cuando el OTP es válido', async () => {
      mockOtpService.verifyOtp.mockResolvedValue({
        valid: true,
        user: { id: 'u1', email: 'a@b.com', phone: '+573001234567' },
        reason: null,
      });

      const res = makeRes();
      await authController.verifyOtp(
        { body: { email: 'a@b.com', otp_code: '123456' } },
        res,
        () => {},
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.accessToken).toBe('access-token');
      expect(res.body.refreshToken).toBe('refresh-token');
    });

    it('valida el payload y responde 400 VALIDATION_ERROR', async () => {
      const res = makeRes();
      await authController.verifyOtp({ body: { email: 'a@b.com' } }, res, () => {});
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('resendOtp', () => {
    it('regenera el OTP y responde 200 para un usuario registrado', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        phone: '+573001234567',
      });

      const res = makeRes();
      await authController.resendOtp({ body: { email: 'a@b.com' } }, res, () => {});

      expect(mockOtpService.generateAndSaveOtp).toHaveBeenCalledWith('u1');
      expect(mockOtpService.sendOtp).toHaveBeenCalledWith('a@b.com', '+573001234567', '123456');
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('nuevo código OTP');
    });

    it('responde 200 neutro si el usuario no existe (antienumeración)', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const res = makeRes();
      await authController.resendOtp({ body: { phone: '+573001234567' } }, res, () => {});

      expect(res.statusCode).toBe(200);
      expect(mockOtpService.generateAndSaveOtp).not.toHaveBeenCalled();
      expect(res.body.message).toContain('Si el correo o teléfono está registrado');
    });

    it('responde 400 VALIDATION_ERROR cuando falta email/phone', async () => {
      const res = makeRes();
      await authController.resendOtp({ body: {} }, res, () => {});
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('logout', () => {
    it('revoca el refresh token y responde 200', async () => {
      const res = makeRes();
      await authController.logout({ body: { refreshToken: 'refresh-token' } }, res, () => {});

      expect(mockAuthService.revokeRefreshToken).toHaveBeenCalledWith('refresh-token');
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Sesión cerrada');
    });

    it('responde 401 si el refresh token ya fue revocado', async () => {
      mockAuthService.revokeRefreshToken.mockResolvedValue(false);

      const res = makeRes();
      await authController.logout({ body: { refreshToken: 'refresh-token' } }, res, () => {});

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('INVALID_REFRESH_TOKEN');
    });

    it('responde 400 si falta el refresh token', async () => {
      const res = makeRes();
      await authController.logout({ body: {} }, res, () => {});

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('VALIDATION_ERROR');
      expect(mockAuthService.revokeRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('register -> shape del response y desambiguación 409', () => {
    it('responde 201 con user.id, email, phone canonicalizado e is_verified', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);
      mockQueryBuilder.insert.mockImplementation(() => ({
        returning: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            full_name: 'Test User',
            email: 'a@b.com',
            phone: '+573001234567',
            is_verified: false,
          },
        ]),
      }));

      const res = makeRes();
      await authController.register(
        {
          body: {
            full_name: 'Test User',
            email: 'a@b.com',
            phone: '3001234567',
            password: 'Strong1!',
          },
        },
        res,
        () => {},
      );

      expect(res.statusCode).toBe(201);
      expect(res.body.user).toEqual({
        id: 'u1',
        email: 'a@b.com',
        phone: '+573001234567',
        is_verified: false,
      });
      expect(mockOtpService.generateAndSaveOtp).toHaveBeenCalledWith('u1');
    });

    it('responde 409 con fields: ["email"] cuando solo el correo está en uso', async () => {
      mockQueryBuilder.first
        .mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' }) // email check
        .mockResolvedValueOnce(null); // phone check

      const res = makeRes();
      await authController.register(
        {
          body: {
            full_name: 'Test User',
            email: 'a@b.com',
            phone: '3001234567',
            password: 'Strong1!',
          },
        },
        res,
        () => {},
      );

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('CONFLICT_ERROR');
      expect(res.body.fields).toEqual(['email']);
    });

    it('responde 409 con fields: ["phone"] cuando solo el teléfono está en uso', async () => {
      mockQueryBuilder.first
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'u2', phone: '+573001234567' }); // phone check

      const res = makeRes();
      await authController.register(
        {
          body: {
            full_name: 'Test User',
            email: 'a@b.com',
            phone: '3001234567',
            password: 'Strong1!',
          },
        },
        res,
        () => {},
      );

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('CONFLICT_ERROR');
      expect(res.body.fields).toEqual(['phone']);
    });

    it('responde 409 con fields: ["email", "phone"] cuando ambos están en uso', async () => {
      mockQueryBuilder.first
        .mockResolvedValueOnce({ id: 'u1', email: 'a@b.com' }) // email check
        .mockResolvedValueOnce({ id: 'u2', phone: '+573001234567' }); // phone check

      const res = makeRes();
      await authController.register(
        {
          body: {
            full_name: 'Test User',
            email: 'a@b.com',
            phone: '3001234567',
            password: 'Strong1!',
          },
        },
        res,
        () => {},
      );

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toBe('CONFLICT_ERROR');
      expect(res.body.fields).toEqual(['email', 'phone']);
    });
  });
});
