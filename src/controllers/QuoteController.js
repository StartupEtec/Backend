import quoteService from '../services/QuoteService.js';
import logger from '../utils/logger.js';
import { createQuoteSchema, updateQuoteStatusSchema } from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

class QuoteController {
  async create(req, res, next) {
    try {
      const { order_id } = req.params;

      const { error, value } = createQuoteSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await quoteService.createQuote(req.user.user_id, order_id, value);

      if (result.error === 'ORDER_NOT_FOUND') {
        return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Orden no encontrada');
      }
      if (result.error === 'ORDER_NOT_ACTIVE') {
        return errorResponse(
          res,
          409,
          'ORDER_NOT_ACTIVE',
          'La orden no está en un estado en el que se pueda cotizar',
        );
      }
      if (result.error === 'FORBIDDEN') {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'Solo el trabajador asignado a la orden puede crear cotizaciones',
        );
      }

      return res.status(201).json({
        message: 'Cotización creada correctamente',
        quote: result,
      });
    } catch (err) {
      logger.error('Error al crear cotización:', err);
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { order_id } = req.params;

      const result = await quoteService.listQuotesByOrder(order_id, req.user.user_id);

      if (result.error === 'ORDER_NOT_FOUND') {
        return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Orden no encontrada');
      }
      if (result.error === 'FORBIDDEN') {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No tienes permiso para ver las cotizaciones de esta orden',
        );
      }

      return res.status(200).json({
        quotes: result,
        count: result.length,
      });
    } catch (err) {
      logger.error('Error al listar cotizaciones:', err);
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { quote_id } = req.params;

      const quote = await quoteService.getQuoteById(quote_id, req.user.user_id);

      if (!quote) {
        return errorResponse(
          res,
          404,
          'QUOTE_NOT_FOUND',
          'Cotización no encontrada o no tienes acceso a ella',
        );
      }

      return res.status(200).json(quote);
    } catch (err) {
      logger.error('Error al obtener cotización:', err);
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { quote_id } = req.params;

      const { error, value } = updateQuoteStatusSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await quoteService.updateQuoteStatus(quote_id, req.user.user_id, value);

      if (result.error === 'QUOTE_NOT_FOUND') {
        return errorResponse(res, 404, 'QUOTE_NOT_FOUND', 'Cotización no encontrada');
      }
      if (result.error === 'FORBIDDEN') {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No tienes permiso para cambiar el estado de esta cotización',
        );
      }
      if (result.error === 'INVALID_TRANSITION') {
        return errorResponse(res, 409, 'INVALID_TRANSITION', result.message);
      }
      if (result.error === 'PAYMENT_ALREADY_STARTED') {
        return errorResponse(
          res,
          409,
          'PAYMENT_ALREADY_STARTED',
          'Ya existe un pago iniciado para esta orden',
        );
      }
      if (result.error === 'MISSING_ORDER_PARTICIPANTS') {
        return errorResponse(
          res,
          409,
          'MISSING_ORDER_PARTICIPANTS',
          'La orden no tiene perfiles válidos de cliente y trabajador',
        );
      }

      return res.status(200).json({
        message: 'Estado de cotización actualizado correctamente',
        quote: result,
      });
    } catch (err) {
      logger.error('Error al actualizar estado de cotización:', err);
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const { quote_id } = req.params;

      const result = await quoteService.deleteQuote(quote_id, req.user.user_id);

      if (result.error === 'QUOTE_NOT_FOUND') {
        return errorResponse(res, 404, 'QUOTE_NOT_FOUND', 'Cotización no encontrada');
      }
      if (result.error === 'FORBIDDEN') {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'Solo el trabajador de la orden puede eliminar la cotización',
        );
      }
      if (result.error === 'QUOTE_NOT_PENDING') {
        return errorResponse(
          res,
          409,
          'QUOTE_NOT_PENDING',
          'Solo se pueden eliminar cotizaciones en estado PENDING',
        );
      }

      return res.status(200).json({ message: 'Cotización eliminada correctamente' });
    } catch (err) {
      logger.error('Error al eliminar cotización:', err);
      next(err);
    }
  }
}

export default new QuoteController();
