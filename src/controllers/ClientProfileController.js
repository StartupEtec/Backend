import clientProfileService from '../services/ClientProfileService.js';
import logger from '../utils/logger.js';
import { createClientProfileSchema, updateClientProfileSchema } from '../utils/validation.js';

class ClientProfileController {
  async getProfile(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No tienes permiso para acceder a este perfil',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const profile = await clientProfileService.getProfile(id);

      if (!profile) {
        return res.status(404).json({
          error: 'CLIENT_PROFILE_NOT_FOUND',
          message: 'Perfil de cliente no encontrado. Crea uno con POST.',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json(profile);
    } catch (err) {
      logger.error('Error al obtener perfil de cliente:', err);
      next(err);
    }
  }

  async createProfile(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No tienes permiso para crear este perfil',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const { error, value } = createClientProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const profile = await clientProfileService.createProfile(id, value);

      if (!profile) {
        return res.status(409).json({
          error: 'CLIENT_PROFILE_EXISTS',
          message: 'El perfil de cliente ya existe. Usa PATCH para actualizarlo.',
          statusCode: 409,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(201).json({
        message: 'Perfil de cliente creado correctamente',
        profile,
      });
    } catch (err) {
      logger.error('Error al crear perfil de cliente:', err);
      next(err);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No tienes permiso para actualizar este perfil',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const { error, value } = updateClientProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const profile = await clientProfileService.updateProfile(id, value);

      if (!profile) {
        return res.status(404).json({
          error: 'CLIENT_PROFILE_NOT_FOUND',
          message: 'Perfil de cliente no encontrado. Crea uno con POST primero.',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        message: 'Perfil de cliente actualizado correctamente',
        profile,
      });
    } catch (err) {
      logger.error('Error al actualizar perfil de cliente:', err);
      next(err);
    }
  }
}

export default new ClientProfileController();
