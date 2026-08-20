import securityConfigService from '../services/SecurityConfigService.js';
import logger from '../utils/logger.js';
import {
  changePasswordSchema,
  changeEmailSchema,
  verifyEmailChangeSchema,
  changePhoneSchema,
  verifyPhoneChangeSchema,
} from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

class SecurityConfigController {
  async changePassword(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No tienes permiso para cambiar esta contraseña',
        );
      }

      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await securityConfigService.changePassword(id, value);

      if (result.error) {
        if (result.error === 'USER_NOT_FOUND') {
          return errorResponse(res, 404, 'USER_NOT_FOUND', result.message);
        }
        if (result.error === 'INVALID_CURRENT_PASSWORD') {
          return errorResponse(res, 400, 'INVALID_CURRENT_PASSWORD', result.message);
        }
        if (result.error === 'SAME_PASSWORD') {
          return errorResponse(res, 400, 'SAME_PASSWORD', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: 'Contraseña actualizada correctamente',
      });
    } catch (err) {
      logger.error('Error al cambiar contraseña:', err);
      next(err);
    }
  }

  async changeEmail(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No tienes permiso para iniciar el cambio de email',
        );
      }

      const { error, value } = changeEmailSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await securityConfigService.initEmailChange(id, value);

      if (result.error) {
        if (result.error === 'USER_NOT_FOUND') {
          return errorResponse(res, 404, 'USER_NOT_FOUND', result.message);
        }
        if (result.error === 'SAME_EMAIL') {
          return errorResponse(res, 400, 'SAME_EMAIL', result.message);
        }
        if (result.error === 'EMAIL_ALREADY_TAKEN') {
          return errorResponse(res, 409, 'EMAIL_ALREADY_TAKEN', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: 'Flujo de cambio de email iniciado. Se han enviado códigos OTP a ambos correos.',
      });
    } catch (err) {
      logger.error('Error al iniciar cambio de email:', err);
      next(err);
    }
  }

  async verifyEmailChange(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No tienes permiso para verificar el cambio de email',
        );
      }

      const { error, value } = verifyEmailChangeSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await securityConfigService.verifyEmailChange(id, value);

      if (result.error) {
        if (result.error === 'USER_NOT_FOUND') {
          return errorResponse(res, 404, 'USER_NOT_FOUND', result.message);
        }
        if (result.error === 'NO_PENDING_CHANGE') {
          return errorResponse(res, 400, 'NO_PENDING_CHANGE', result.message);
        }
        if (result.error === 'OTP_EXPIRED') {
          return errorResponse(res, 400, 'OTP_EXPIRED', result.message);
        }
        if (result.error === 'INVALID_OTP') {
          return errorResponse(res, 400, 'INVALID_OTP', result.message);
        }
        if (result.error === 'EMAIL_ALREADY_TAKEN') {
          return errorResponse(res, 409, 'EMAIL_ALREADY_TAKEN', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: 'Correo electrónico verificado y cambiado correctamente',
        email: result.new_email,
      });
    } catch (err) {
      logger.error('Error al verificar cambio de email:', err);
      next(err);
    }
  }

  async changePhone(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No tienes permiso para iniciar el cambio de teléfono',
        );
      }

      const { error, value } = changePhoneSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await securityConfigService.initPhoneChange(id, value);

      if (result.error) {
        if (result.error === 'USER_NOT_FOUND') {
          return errorResponse(res, 404, 'USER_NOT_FOUND', result.message);
        }
        if (result.error === 'SAME_PHONE') {
          return errorResponse(res, 400, 'SAME_PHONE', result.message);
        }
        if (result.error === 'PHONE_ALREADY_TAKEN') {
          return errorResponse(res, 409, 'PHONE_ALREADY_TAKEN', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message:
          'Flujo de cambio de teléfono iniciado. Se han enviado códigos OTP a ambos números.',
      });
    } catch (err) {
      logger.error('Error al iniciar cambio de teléfono:', err);
      next(err);
    }
  }

  async verifyPhoneChange(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No tienes permiso para verificar el cambio de teléfono',
        );
      }

      const { error, value } = verifyPhoneChangeSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await securityConfigService.verifyPhoneChange(id, value);

      if (result.error) {
        if (result.error === 'USER_NOT_FOUND') {
          return errorResponse(res, 404, 'USER_NOT_FOUND', result.message);
        }
        if (result.error === 'NO_PENDING_CHANGE') {
          return errorResponse(res, 400, 'NO_PENDING_CHANGE', result.message);
        }
        if (result.error === 'OTP_EXPIRED') {
          return errorResponse(res, 400, 'OTP_EXPIRED', result.message);
        }
        if (result.error === 'INVALID_OTP') {
          return errorResponse(res, 400, 'INVALID_OTP', result.message);
        }
        if (result.error === 'PHONE_ALREADY_TAKEN') {
          return errorResponse(res, 409, 'PHONE_ALREADY_TAKEN', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: 'Teléfono verificado y cambiado correctamente',
        phone: result.new_phone,
      });
    } catch (err) {
      logger.error('Error al verificar cambio de teléfono:', err);
      next(err);
    }
  }
}

export default new SecurityConfigController();
