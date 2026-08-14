import paymentService from '../services/PaymentService.js';
import logger from '../utils/logger.js';
import { createPaymentMethodSchema, updatePaymentMethodSchema } from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

class PaymentController {
  async list(req, res, next) {
    try {
      const { id } = req.params;

      if (id !== req.user.user_id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No autorizado para acceder a estos métodos de pago',
        );
      }

      const methods = await paymentService.listUserPaymentMethods(id);
      return res.status(200).json({ payment_methods: methods });
    } catch (err) {
      logger.error('Error al listar métodos de pago:', err);
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const { id } = req.params;

      if (id !== req.user.user_id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No autorizado para crear un método de pago para este usuario',
        );
      }

      const { error, value } = createPaymentMethodSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await paymentService.createPaymentMethod(id, value);

      if (result.error) {
        if (result.error === 'LIMIT_EXCEEDED') {
          return errorResponse(res, 400, 'LIMIT_EXCEEDED', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(201).json({
        message: 'Método de pago agregado correctamente',
        payment_method: result.paymentMethod,
      });
    } catch (err) {
      logger.error('Error al crear método de pago:', err);
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;

      const { error, value } = updatePaymentMethodSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await paymentService.updatePaymentMethod(id, req.user.user_id, value);

      if (result.error) {
        if (result.error === 'PAYMENT_METHOD_NOT_FOUND') {
          return errorResponse(res, 404, 'PAYMENT_METHOD_NOT_FOUND', result.message);
        }
        if (result.error === 'FORBIDDEN') {
          return errorResponse(res, 403, 'FORBIDDEN', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: 'Método de pago actualizado correctamente',
        payment_method: result.paymentMethod,
      });
    } catch (err) {
      logger.error('Error al actualizar método de pago:', err);
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;

      const result = await paymentService.deletePaymentMethod(id, req.user.user_id);

      if (result.error) {
        if (result.error === 'PAYMENT_METHOD_NOT_FOUND') {
          return errorResponse(res, 404, 'PAYMENT_METHOD_NOT_FOUND', result.message);
        }
        if (result.error === 'FORBIDDEN') {
          return errorResponse(res, 403, 'FORBIDDEN', result.message);
        }
        if (result.error === 'PENDING_TRANSACTIONS') {
          return errorResponse(res, 409, 'PENDING_TRANSACTIONS', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', 'Ocurrió un error inesperado');
      }

      return res.status(200).json({
        message: 'Método de pago eliminado correctamente',
      });
    } catch (err) {
      logger.error('Error al eliminar método de pago:', err);
      next(err);
    }
  }
}

export default new PaymentController();
