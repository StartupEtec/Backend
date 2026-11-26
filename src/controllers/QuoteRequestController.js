import db from '../database/db.js';
import quoteRequestService from '../services/QuoteRequestService.js';
import logger from '../utils/logger.js';
import {
  createQuoteRequestSchema,
  createQuoteSchema,
  listQuoteRequestsQuerySchema,
  updateQuoteRequestStatusSchema,
} from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

const LEGACY_CATEGORY_ALIASES = {
  construcción: 'Albañilería y Construcción',
  jardinería: 'Jardinería y Paisajismo',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeCreateBody = async (body, userId) => {
  const normalized = { ...body };

  if (!normalized.category_id && typeof normalized.category === 'string') {
    const value = normalized.category.trim();
    const name = LEGACY_CATEGORY_ALIASES[value.toLowerCase()] ?? value;
    const category = await db('categories')
      .where('active', true)
      .whereRaw('LOWER(name) = LOWER(?)', [name])
      .first();
    if (category) normalized.category_id = category.id;
    delete normalized.category;
  }

  if (
    !normalized.location_id &&
    typeof normalized.location === 'string' &&
    normalized.location.trim()
  ) {
    const value = normalized.location.trim();
    const query = db('locations').where('user_id', userId);
    if (UUID_PATTERN.test(value)) {
      query.where(function () {
        this.where('id', value).orWhereRaw('LOWER(address) = LOWER(?)', [value]);
      });
    } else {
      query.whereRaw('LOWER(address) = LOWER(?)', [value]);
    }
    const location = await query.first();
    if (location) normalized.location_id = location.id;
    delete normalized.location;
  }

  return normalized;
};

class QuoteRequestController {
  async create(req, res, next) {
    try {
      const body = await normalizeCreateBody(req.body, req.user.user_id);
      const { error, value } = createQuoteRequestSchema.validate(body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await quoteRequestService.create(req.user.user_id, value);

      if (result.error === 'CLIENT_PROFILE_REQUIRED') {
        return errorResponse(res, 400, result.error, result.message);
      }
      if (result.error === 'WORKER_NOT_FOUND') {
        return errorResponse(res, 404, result.error, result.message);
      }
      if (result.error === 'SAME_USER') {
        return errorResponse(res, 400, result.error, result.message);
      }
      if (result.error === 'CATEGORY_NOT_FOUND') {
        return errorResponse(res, 404, result.error, result.message);
      }
      if (result.error === 'LOCATION_NOT_FOUND') {
        return errorResponse(res, 404, result.error, result.message);
      }

      return res.status(201).json({
        message: 'Solicitud de cotización creada correctamente',
        request: result,
        quote_request: result,
      });
    } catch (err) {
      logger.error('Error al crear solicitud de cotización:', err);
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { error, value } = listQuoteRequestsQuerySchema.validate(req.query);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await quoteRequestService.list(req.user.user_id, value);
      return res.status(200).json({ ...result, quote_requests: result.requests });
    } catch (err) {
      logger.error('Error al listar solicitudes de cotización:', err);
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const request = await quoteRequestService.getById(req.params.id, req.user.user_id);
      if (!request) {
        return errorResponse(
          res,
          404,
          'REQUEST_NOT_FOUND',
          'Solicitud no encontrada o no tienes acceso a ella',
        );
      }
      return res.status(200).json(request);
    } catch (err) {
      logger.error('Error al obtener solicitud de cotización:', err);
      next(err);
    }
  }

  async createQuote(req, res, next) {
    try {
      const { error, value } = createQuoteSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await quoteRequestService.createQuoteFromRequest(
        req.params.id,
        req.user.user_id,
        value,
      );

      if (result.error === 'REQUEST_NOT_FOUND') {
        return errorResponse(res, 404, result.error, 'Solicitud no encontrada');
      }
      if (result.error === 'FORBIDDEN') {
        return errorResponse(
          res,
          403,
          result.error,
          'Solo el trabajador solicitado puede cotizar esta solicitud',
        );
      }
      if (result.error === 'REQUEST_NOT_PENDING') {
        return errorResponse(
          res,
          409,
          result.error,
          'La solicitud ya no está pendiente de cotización',
        );
      }
      if (result.error === 'MISSING_REQUEST_PARTICIPANTS') {
        return errorResponse(
          res,
          409,
          result.error,
          'La solicitud no tiene perfiles válidos de cliente y trabajador',
        );
      }
      if (result.error === 'ORDER_NOT_ACTIVE') {
        return errorResponse(
          res,
          409,
          result.error,
          'La orden vinculada no está en un estado en el que se pueda cotizar',
        );
      }

      return res.status(201).json({
        message: 'Cotización creada correctamente desde la solicitud',
        quote: result,
      });
    } catch (err) {
      logger.error('Error al cotizar solicitud:', err);
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { error, value } = updateQuoteRequestStatusSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await quoteRequestService.updateStatus(req.params.id, req.user.user_id, value);

      if (result.error === 'REQUEST_NOT_FOUND') {
        return errorResponse(res, 404, result.error, 'Solicitud no encontrada');
      }
      if (result.error === 'FORBIDDEN') {
        return errorResponse(
          res,
          403,
          result.error,
          'No tienes permiso para cambiar el estado de esta solicitud',
        );
      }
      if (result.error === 'INVALID_TRANSITION') {
        return errorResponse(res, 409, result.error, result.message);
      }

      return res.status(200).json({
        message: 'Estado de la solicitud actualizado correctamente',
        request: result,
        quote_request: result,
      });
    } catch (err) {
      logger.error('Error al actualizar solicitud de cotización:', err);
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const result = await quoteRequestService.remove(req.params.id, req.user.user_id);

      if (result.error === 'REQUEST_NOT_FOUND') {
        return errorResponse(res, 404, result.error, 'Solicitud no encontrada');
      }
      if (result.error === 'FORBIDDEN') {
        return errorResponse(res, 403, result.error, 'Solo el cliente puede eliminar su solicitud');
      }
      if (result.error === 'REQUEST_NOT_PENDING') {
        return errorResponse(
          res,
          409,
          result.error,
          'Solo se pueden eliminar solicitudes en estado PENDING',
        );
      }

      return res.status(200).json({ message: 'Solicitud eliminada correctamente' });
    } catch (err) {
      logger.error('Error al eliminar solicitud de cotización:', err);
      next(err);
    }
  }
}

export default new QuoteRequestController();
