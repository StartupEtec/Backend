import disputeService from '../services/DisputeService.js';
import logger from '../utils/logger.js';
import {
  createDisputeSchema,
  listDisputesQuerySchema,
  resolveDisputeSchema,
} from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

class DisputeController {
  async create(req, res, next) {
    try {
      const { error, value } = createDisputeSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await disputeService.createDispute(req.user.user_id, value);

      if (result.error) {
        if (result.error === 'ORDER_NOT_FOUND') {
          return errorResponse(res, 404, 'ORDER_NOT_FOUND', result.message);
        }
        if (result.error === 'MISSING_ORDER_PARTICIPANTS') {
          return errorResponse(res, 400, 'MISSING_ORDER_PARTICIPANTS', result.message);
        }
        if (result.error === 'FORBIDDEN') {
          return errorResponse(res, 403, 'FORBIDDEN', result.message);
        }
        if (result.error === 'INVALID_ORDER_STATUS') {
          return errorResponse(res, 409, 'INVALID_ORDER_STATUS', result.message);
        }
        if (result.error === 'DISPUTE_ALREADY_EXISTS') {
          return errorResponse(res, 409, 'DISPUTE_ALREADY_EXISTS', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(201).json({
        message: 'Disputa creada correctamente',
        dispute: result.dispute,
      });
    } catch (err) {
      logger.error('Error al abrir disputa:', err);
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { error, value } = listDisputesQuerySchema.validate(req.query);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await disputeService.listDisputes(req.user.user_id, req.user.role, value);
      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al listar disputas:', err);
      next(err);
    }
  }

  async resolve(req, res, next) {
    try {
      const { id } = req.params;
      const { error, value } = resolveDisputeSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await disputeService.resolveDispute(id, req.user.user_id, value);

      if (result.error) {
        if (result.error === 'DISPUTE_NOT_FOUND') {
          return errorResponse(res, 404, 'DISPUTE_NOT_FOUND', result.message);
        }
        if (result.error === 'DISPUTE_NOT_OPEN') {
          return errorResponse(res, 409, 'DISPUTE_NOT_OPEN', result.message);
        }
        if (result.error === 'ORDER_NOT_FOUND') {
          return errorResponse(res, 404, 'ORDER_NOT_FOUND', result.message);
        }
        if (result.error === 'REFUND_FAILED') {
          return errorResponse(res, 502, 'REFUND_FAILED', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: 'Disputa resuelta/cerrada correctamente',
        dispute: result.dispute,
      });
    } catch (err) {
      logger.error('Error al resolver disputa:', err);
      next(err);
    }
  }
}

export default new DisputeController();
