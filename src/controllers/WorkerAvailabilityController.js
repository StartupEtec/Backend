import workerAvailabilityService from '../services/WorkerAvailabilityService.js';
import logger from '../utils/logger.js';
import { createAvailabilitySchema, updateAvailabilitySchema } from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

class WorkerAvailabilityController {
  async create(req, res, next) {
    try {
      const { id } = req.params;

      const { error, value } = createAvailabilitySchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await workerAvailabilityService.createAvailability(
        id,
        req.user.user_id,
        value,
      );

      if (result.error) {
        if (result.error === 'WORKER_PROFILE_NOT_FOUND') {
          return errorResponse(res, 404, 'WORKER_PROFILE_NOT_FOUND', result.message);
        }
        if (result.error === 'DAILY_LIMIT_REACHED') {
          return errorResponse(res, 409, 'DAILY_LIMIT_REACHED', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(201).json({
        message: 'Disponibilidad creada correctamente',
        availability: result,
      });
    } catch (err) {
      logger.error('Error al crear disponibilidad:', err);
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { id } = req.params;

      const result = await workerAvailabilityService.listAvailability(id, req.user.user_id);

      if (result.error === 'WORKER_PROFILE_NOT_FOUND') {
        return errorResponse(res, 404, 'WORKER_PROFILE_NOT_FOUND', result.message);
      }

      return res.status(200).json({
        availability: result,
        count: result.length,
      });
    } catch (err) {
      logger.error('Error al listar disponibilidad:', err);
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;

      const { error, value } = updateAvailabilitySchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await workerAvailabilityService.updateAvailability(
        id,
        req.user.user_id,
        value,
      );

      if (result.error) {
        if (result.error === 'AVAILABILITY_NOT_FOUND') {
          return errorResponse(res, 404, 'AVAILABILITY_NOT_FOUND', result.message);
        }
        if (result.error === 'INVALID_TIME_RANGE') {
          return errorResponse(res, 400, 'INVALID_TIME_RANGE', result.message);
        }
        if (result.error === 'DAILY_LIMIT_REACHED') {
          return errorResponse(res, 409, 'DAILY_LIMIT_REACHED', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: 'Disponibilidad actualizada correctamente',
        availability: result,
      });
    } catch (err) {
      logger.error('Error al actualizar disponibilidad:', err);
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const { id } = req.params;

      const result = await workerAvailabilityService.deleteAvailability(id, req.user.user_id);

      if (result.error === 'AVAILABILITY_NOT_FOUND') {
        return errorResponse(res, 404, 'AVAILABILITY_NOT_FOUND', result.message);
      }

      return res.status(200).json({
        message: 'Disponibilidad eliminada correctamente',
      });
    } catch (err) {
      logger.error('Error al eliminar disponibilidad:', err);
      next(err);
    }
  }
}

export default new WorkerAvailabilityController();
