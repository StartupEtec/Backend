import userService from '../services/UserService.js';
import authService from '../services/AuthService.js';
import logger from '../utils/logger.js';
import { updateProfileSchema, switchRoleSchema } from '../utils/validation.js';

class UserController {
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      const profile = await userService.getPublicProfile(id);

      if (!profile) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json(profile);
    } catch (err) {
      logger.error('Error al obtener perfil público:', err);
      next(err);
    }
  }

  async getMyProfile(req, res, next) {
    try {
      const profile = await userService.getPrivateProfile(req.user.user_id);

      if (!profile) {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'Usuario no encontrado',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json(profile);
    } catch (err) {
      logger.error('Error al obtener perfil privado:', err);
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No tienes permiso para editar este perfil',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const { error, value } = updateProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const updatedProfile = await userService.updateProfile(id, value, req.user.current_role);

      return res.status(200).json({
        message: 'Perfil actualizado correctamente',
        profile: updatedProfile,
      });
    } catch (err) {
      logger.error('Error al actualizar perfil:', err);
      next(err);
    }
  }

  async switchRole(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No tienes permiso para cambiar el rol de otro usuario',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const { error, value } = switchRoleSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const { role: newRole } = value;

      const result = await userService.switchRole(id, newRole);

      if (result.error) {
        const statusMap = {
          USER_NOT_FOUND: 404,
          SAME_ROLE: 409,
          MISSING_CLIENT_PROFILE: 409,
          MISSING_WORKER_PROFILE: 409,
          WORKER_NOT_CERTIFIED: 403,
        };
        return res.status(statusMap[result.error] || 400).json({
          error: result.error,
          message: result.message,
          statusCode: statusMap[result.error] || 400,
          timestamp: new Date().toISOString(),
        });
      }

      const accessToken = authService.generateAccessToken({
        id: result.user.id,
        email: result.user.email,
        current_role: result.user.current_role,
      });

      return res.status(200).json({
        new_role: result.user.current_role,
        previous_role: result.previousRole,
        accessToken,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logger.error('Error al cambiar de rol:', err);
      next(err);
    }
  }
}

export default new UserController();
