import workerProfileService from '../services/WorkerProfileService.js';
import logger from '../utils/logger.js';
import { createWorkerProfileSchema, updateWorkerProfileSchema } from '../utils/validation.js';

class WorkerProfileController {
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

      const profile = await workerProfileService.getProfile(id);

      if (!profile) {
        return res.status(404).json({
          error: 'WORKER_PROFILE_NOT_FOUND',
          message: 'Perfil de trabajador no encontrado. Crea uno con POST.',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json(profile);
    } catch (err) {
      logger.error('Error al obtener perfil de trabajador:', err);
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

      const { error, value } = createWorkerProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const profile = await workerProfileService.createProfile(id, value);

      if (!profile) {
        return res.status(409).json({
          error: 'WORKER_PROFILE_EXISTS',
          message: 'El perfil de trabajador ya existe. Usa PATCH para actualizarlo.',
          statusCode: 409,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(201).json({
        message: 'Perfil de trabajador creado correctamente',
        profile,
      });
    } catch (err) {
      logger.error('Error al crear perfil de trabajador:', err);
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

      const { error, value } = updateWorkerProfileSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const profile = await workerProfileService.updateProfile(id, value);

      if (!profile) {
        return res.status(404).json({
          error: 'WORKER_PROFILE_NOT_FOUND',
          message: 'Perfil de trabajador no encontrado. Crea uno con POST primero.',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        message: 'Perfil de trabajador actualizado correctamente',
        profile,
      });
    } catch (err) {
      logger.error('Error al actualizar perfil de trabajador:', err);
      next(err);
    }
  }
}

export default new WorkerProfileController();
