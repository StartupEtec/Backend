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
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema,
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

  async forgotPassword(req, res, next) {
    try {
      const { error, value } = forgotPasswordSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const { email, phone } = value;

      // Find user
      const query = db('users');
      if (email) {
        query.where({ email });
      } else if (phone) {
        query.where({ phone });
      }

      const user = await query.first();

      if (!user) {
        // Return 404 if user doesn't exist
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'El correo electrónico o teléfono no está registrado',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      // Generate 6-digit code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      const resetExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

      // Save code in user record
      await db('users').where({ id: user.id }).update({
        reset_code: resetCode,
        reset_expires_at: resetExpiresAt,
      });

      // Simulation - log sending the code
      const message = `Tu código de recuperación es: ${resetCode}. Expira en 30 minutos.`;
      if (user.email) {
        logger.info('[PASSWORD_RESET] Email de recuperación enviado (simulación)', {
          email: user.email,
          message,
        });
      }
      if (user.phone) {
        logger.info('[PASSWORD_RESET] SMS de recuperación enviado (simulación)', {
          phone: user.phone,
          message,
        });
      }

      return res.status(200).json({
        message: 'Código de recuperación enviado correctamente.',
      });
    } catch (err) {
      logger.error('Error durante la solicitud de recuperación de contraseña:', err);
      next(err);
    }
  }

  async verifyResetCode(req, res, next) {
    try {
      const { error, value } = verifyResetCodeSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const { email, phone, reset_code } = value;

      // Find user
      const query = db('users');
      if (email) {
        query.where({ email });
      } else if (phone) {
        query.where({ phone });
      }

      const user = await query.first();

      if (!user) {
        return res.status(400).json({
          error: 'INVALID_RESET_CODE',
          message: 'Código de recuperación inválido o expirado',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Check code and expiration
      if (!user.reset_code || user.reset_code !== reset_code) {
        logger.warn('Intento de recuperación fallido: Código incorrecto', {
          email: user.email,
          phone: user.phone,
        });
        return res.status(400).json({
          error: 'INVALID_RESET_CODE',
          message: 'Código de recuperación inválido o expirado',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const now = new Date();
      if (new Date(user.reset_expires_at) < now) {
        logger.warn('Intento de recuperación fallido: Código expirado', {
          email: user.email,
          phone: user.phone,
        });
        return res.status(400).json({
          error: 'EXPIRED_RESET_CODE',
          message: 'Código de recuperación inválido o expirado',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Generate temporal token valid for 10 minutes
      const tempToken = authService.generateResetPasswordToken(user);

      // Clear reset code fields on successful verification
      await db('users').where({ id: user.id }).update({
        reset_code: null,
        reset_expires_at: null,
      });

      return res.status(200).json({
        message: 'Código verificado correctamente.',
        token: tempToken,
      });
    } catch (err) {
      logger.error('Error al verificar el código de recuperación:', err);
      next(err);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { error, value } = resetPasswordSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const { token, password } = value;

      // Decode token without verification first to get the user
      const decoded = authService.decodeToken(token);
      if (!decoded || !decoded.user_id || decoded.purpose !== 'password_reset') {
        return res.status(400).json({
          error: 'INVALID_TOKEN',
          message: 'Token temporal inválido o expirado',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Fetch user from DB
      const user = await db('users').where({ id: decoded.user_id }).first();
      if (!user) {
        return res.status(400).json({
          error: 'INVALID_TOKEN',
          message: 'Token temporal inválido o expirado',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Verify signature with current user password hash (single-use check)
      const verified = authService.verifyResetPasswordToken(token, user);
      if (!verified) {
        logger.warn(
          'Intento de restablecimiento de contraseña fallido: Token inválido o ya utilizado',
          { user_id: user.id },
        );
        return res.status(400).json({
          error: 'INVALID_TOKEN',
          message: 'Token temporal inválido o expirado',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(password, 10);

      // Update password hash in DB
      await db('users').where({ id: user.id }).update({
        password_hash: passwordHash,
      });

      // Audit log
      logger.info('Auditoría: Restablecimiento de contraseña completado con éxito', {
        user_id: user.id,
      });

      return res.status(200).json({
        message: 'Contraseña restablecida correctamente.',
      });
    } catch (err) {
      logger.error('Error al restablecer la contraseña:', err);
      next(err);
    }
  }
}

export default new AuthController();
