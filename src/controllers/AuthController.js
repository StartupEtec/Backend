import bcrypt from 'bcrypt';
import db from '../database/db.js';
import otpService from '../services/OtpService.js';
import authService from '../services/AuthService.js';
import logger from '../utils/logger.js';
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  refreshTokenSchema,
} from '../utils/validation.js';

class AuthController {
  async register(req, res, next) {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const { email, phone, password } = value;

      // Check if user already exists
      const existingUser = await db('users').where({ email }).orWhere({ phone }).first();

      if (existingUser) {
        return res.status(409).json({
          error: 'CONFLICT_ERROR',
          message: 'El correo electrónico o teléfono ya están registrados',
          statusCode: 409,
          timestamp: new Date().toISOString(),
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Save user (transactional or simple write)
      const [newUser] = await db('users')
        .insert({
          email,
          phone,
          password_hash: passwordHash,
          is_verified: false,
        })
        .returning(['id', 'email', 'phone']);

      // Generate and send OTP
      const otpCode = await otpService.generateAndSaveOtp(newUser.id);
      await otpService.sendOtp(newUser.email, newUser.phone, otpCode);

      return res.status(201).json({
        message:
          'Usuario registrado correctamente. Por favor verifica tu cuenta con el código OTP enviado.',
        user: {
          id: newUser.id,
          email: newUser.email,
          phone: newUser.phone,
        },
      });
    } catch (err) {
      logger.error('Error durante el registro del usuario:', err);
      next(err);
    }
  }

  async login(req, res, next) {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const { email, phone, password } = value;

      // Find user
      const query = db('users');
      if (email) {
        query.where({ email });
      } else if (phone) {
        query.where({ phone });
      }

      const user = await query.first();

      if (!user) {
        logger.warn('Intento de inicio de sesión fallido: Usuario no encontrado', { email, phone });
        return res.status(401).json({
          error: 'AUTH_FAILED',
          message: 'Credenciales incorrectas',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        });
      }

      // Compare password
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        logger.warn('Intento de inicio de sesión fallido: Contraseña incorrecta', {
          email: user.email,
          phone: user.phone,
        });
        return res.status(401).json({
          error: 'AUTH_FAILED',
          message: 'Credenciales incorrectas',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        });
      }

      // Generate OTP
      const otpCode = await otpService.generateAndSaveOtp(user.id);
      await otpService.sendOtp(user.email, user.phone, otpCode);

      return res.status(200).json({
        status: 'PENDING_VERIFICATION',
        message: 'Código OTP enviado al correo/teléfono registrado.',
        user: {
          id: user.id,
          email: user.email,
        },
      });
    } catch (err) {
      logger.error('Error durante el inicio de sesión:', err);
      next(err);
    }
  }

  async verifyOtp(req, res, next) {
    try {
      const { error, value } = verifyOtpSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const { email, phone, otp_code } = value;
      const targetIdentifier = email || phone;

      const user = await otpService.verifyOtp(targetIdentifier, otp_code);
      if (!user) {
        return res.status(400).json({
          error: 'INVALID_OTP',
          message: 'Código OTP inválido o expirado',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Issue tokens
      const accessToken = authService.generateAccessToken(user);
      const refreshToken = await authService.generateRefreshToken(user.id);

      return res.status(200).json({
        message: 'Verificación exitosa',
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
        },
      });
    } catch (err) {
      logger.error('Error al verificar el OTP:', err);
      next(err);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const { refreshToken } = value;

      const newTokens = await authService.refreshAccessToken(refreshToken);
      if (!newTokens) {
        return res.status(401).json({
          error: 'INVALID_REFRESH_TOKEN',
          message: 'Token de refresco inválido, expirado o ya utilizado',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      });
    } catch (err) {
      logger.error('Error al refrescar el token:', err);
      next(err);
    }
  }
}

export default new AuthController();
