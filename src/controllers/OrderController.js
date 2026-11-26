import orderService from '../services/OrderService.js';
import logger from '../utils/logger.js';
import {
  updateOrderStatusSchema,
  createOrderSchema,
  listUserOrdersQuerySchema,
  completeOrderSchema,
} from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

class OrderController {
  async create(req, res, next) {
    try {
      const { error, value } = createOrderSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await orderService.createOrder(req.user.user_id, value);

      if (result.error) {
        if (result.error === 'CLIENT_PROFILE_REQUIRED') {
          return errorResponse(res, 400, 'CLIENT_PROFILE_REQUIRED', result.message);
        }
        if (result.error === 'WORKER_NOT_FOUND') {
          return errorResponse(res, 404, 'WORKER_NOT_FOUND', result.message);
        }
        if (result.error === 'CATEGORY_NOT_FOUND') {
          return errorResponse(res, 404, 'CATEGORY_NOT_FOUND', result.message);
        }
        if (result.error === 'LOCATION_NOT_FOUND') {
          return errorResponse(res, 404, 'LOCATION_NOT_FOUND', result.message);
        }
        if (result.error === 'SAME_USER') {
          return errorResponse(res, 400, 'SAME_USER', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(201).json({
        message: 'Orden creada correctamente',
        order: result,
      });
    } catch (err) {
      logger.error('Error al crear orden:', err);
      next(err);
    }
  }

  async listUserOrders(req, res, next) {
    try {
      const { id } = req.params;
      if (id !== req.user.user_id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No autorizado para listar órdenes de otro usuario',
        );
      }

      const { error, value } = listUserOrdersQuerySchema.validate(req.query);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await orderService.listUserOrders(req.user.user_id, value);
      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al listar órdenes del usuario:', err);
      next(err);
    }
  }

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
        if (result.error === 'INVALID_TRANSITION' || result.error === 'TRANSACTION_NOT_FOUND') {
          return errorResponse(res, 409, 'INVALID_TRANSITION', result.message);
        }
        if (result.error === 'REFUND_FAILED') {
          return errorResponse(
            res,
            502,
            'REFUND_FAILED',
            result.message || 'No se pudo reembolsar a la tarjeta del cliente',
          );
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

  async complete(req, res, next) {
    try {
      const { id } = req.params;

      const { error, value } = completeOrderSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await orderService.completeOrder(id, req.user.user_id, value);

      if (result.error) {
        if (result.error === 'ORDER_NOT_FOUND') {
          return errorResponse(res, 404, 'ORDER_NOT_FOUND', 'Orden no encontrada');
        }
        if (result.error === 'FORBIDDEN') {
          return errorResponse(
            res,
            403,
            'FORBIDDEN',
            'No autorizado para confirmar la finalización de esta orden',
          );
        }
        if (result.error === 'INVALID_TRANSITION') {
          return errorResponse(res, 409, 'INVALID_TRANSITION', result.message);
        }
        if (result.error === 'ALREADY_CONFIRMED') {
          return errorResponse(res, 409, 'ALREADY_CONFIRMED', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: result.bothConfirmed
          ? 'Servicio completado y escrow liberado'
          : 'Confirmación registrada. Se requiere la confirmación de ambas partes',
        order: result.order,
        bothConfirmed: result.bothConfirmed,
        clientConfirmed: result.clientConfirmed,
        workerConfirmed: result.workerConfirmed,
      });
    } catch (err) {
      logger.error('Error al confirmar finalización del servicio:', err);
      next(err);
    }
  }
}

export default new OrderController();
