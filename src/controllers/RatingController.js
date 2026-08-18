import ratingService from '../services/RatingService.js';
import logger from '../utils/logger.js';
import { createRatingSchema, listRatingsQuerySchema } from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

class RatingController {
  async create(req, res, next) {
    try {
      const { error, value } = createRatingSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await ratingService.createRating(req.user.user_id, value);

      if (result.error) {
        if (result.error === 'ORDER_NOT_FOUND') {
          return errorResponse(res, 404, 'ORDER_NOT_FOUND', result.message);
        }
        if (result.error === 'ORDER_NOT_COMPLETED') {
          return errorResponse(res, 409, 'ORDER_NOT_COMPLETED', result.message);
        }
        if (result.error === 'FORBIDDEN') {
          return errorResponse(res, 403, 'FORBIDDEN', result.message);
        }
        if (result.error === 'ALREADY_RATED') {
          return errorResponse(res, 409, 'ALREADY_RATED', result.message);
        }
        if (result.error === 'MISSING_ORDER_PARTICIPANTS') {
          return errorResponse(res, 400, 'MISSING_ORDER_PARTICIPANTS', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(201).json({
        message: 'Calificación creada correctamente',
        rating: result,
      });
    } catch (err) {
      logger.error('Error al crear calificación:', err);
      next(err);
    }
  }

  async listByUser(req, res, next) {
    try {
      const { id } = req.params;

      const { error, value } = listRatingsQuerySchema.validate(req.query);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await ratingService.listRatingsByUser(id, value);
      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al listar calificaciones:', err);
      next(err);
    }
  }

  async getAverage(req, res, next) {
    try {
      const { id } = req.params;
      const result = await ratingService.getRatingAverage(id);
      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al obtener promedio de calificaciones:', err);
      next(err);
    }
  }
}

export default new RatingController();
