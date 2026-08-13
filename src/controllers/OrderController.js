import orderService from '../services/OrderService.js';
import logger from '../utils/logger.js';
import { updateOrderStatusSchema } from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

class OrderController {
  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const order = await orderService.getOrderById(id, req.user.user_id);
      if (!order) {
        return errorResponse(
          res,
          404,
          'ORDER_NOT_FOUND',
          'Orden no encontrada o no tienes acceso a ella',
        );
      }

      return res.status(200).json({ order });
    } catch (err) {
      logger.error('Error al obtener orden:', err);
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;

      const { error, value } = updateOrderStatusSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await orderService.updateOrderStatus(id, req.user.user_id, value.status);

      if (result.error) {
        if (result.error === 'ORDER_NOT_FOUND') {
          return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Orden no encontrada');
        }
        if (result.error === 'MISSING_ORDER_PARTICIPANTS') {
          return errorResponse(
            res,
            400,
            'MISSING_ORDER_PARTICIPANTS',
            'Faltan participantes de la orden',
          );
        }
        if (result.error === 'FORBIDDEN') {
          return errorResponse(
            res,
            403,
            'FORBIDDEN',
            result.message || 'No autorizado para realizar esta acción',
          );
        }
        if (result.error === 'INVALID_TRANSITION') {
          return errorResponse(res, 409, 'INVALID_TRANSITION', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: 'Estado de orden actualizado correctamente',
        order: result.order,
      });
    } catch (err) {
      logger.error('Error al actualizar estado de la orden:', err);
      next(err);
    }
  }

  async getHistory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await orderService.getOrderHistory(id, req.user.user_id);

      if (result.error) {
        if (result.error === 'ORDER_NOT_FOUND') {
          return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Orden no encontrada');
        }
        if (result.error === 'FORBIDDEN') {
          return errorResponse(
            res,
            403,
            'FORBIDDEN',
            'No tienes acceso al historial de esta orden',
          );
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        events: result.events,
      });
    } catch (err) {
      logger.error('Error al obtener historial de la orden:', err);
      next(err);
    }
  }
}

export default new OrderController();
