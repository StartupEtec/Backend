import userService from '../services/UserService.js';
import logger from '../utils/logger.js';
import { updateProfileSchema } from '../utils/validation.js';

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
}

export default new UserController();
