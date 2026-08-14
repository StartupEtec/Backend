import paymentService from '../services/PaymentService.js';
import logger from '../utils/logger.js';
import {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  processPaymentSchema,
} from '../utils/validation.js';

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

  async process(req, res, next) {
    try {
      const { error, value } = processPaymentSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await paymentService.processStripePayment(
        value.order_id,
        value.payment_method_id,
        value.amount,
        req.user.user_id,
      );

      if (result.error) {
        if (result.error === 'ORDER_NOT_FOUND') {
          return errorResponse(res, 404, 'ORDER_NOT_FOUND', result.message);
        }
        if (result.error === 'FORBIDDEN') {
          return errorResponse(res, 403, 'FORBIDDEN', result.message);
        }
        if (result.error === 'PAYMENT_METHOD_NOT_FOUND') {
          return errorResponse(res, 404, 'PAYMENT_METHOD_NOT_FOUND', result.message);
        }
        if (result.error === 'PAYMENT_ALREADY_STARTED') {
          return errorResponse(res, 409, 'PAYMENT_ALREADY_STARTED', result.message);
        }
        if (result.error === 'PAYMENT_DECLINED') {
          return errorResponse(res, 402, 'PAYMENT_DECLINED', result.message);
        }
        return errorResponse(
          res,
          500,
          'PAYMENT_FAILED',
          result.message || 'Error en el procesamiento del pago',
        );
      }

      if (result.status === 'requires_action') {
        return res.status(200).json({
          status: 'requires_action',
          client_secret: result.client_secret,
          next_action: result.next_action,
        });
      }

      return res.status(200).json({
        status: 'succeeded',
        message: 'Pago procesado exitosamente',
      });
    } catch (err) {
      logger.error('Error en controlador de proceso de pago:', err);
      next(err);
    }
  }

  async stripeWebhook(req, res, next) {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return errorResponse(res, 400, 'BAD_REQUEST', 'Falta la firma del webhook');
    }

    try {
      let event;
      try {
        event = paymentService.constructStripeWebhookEvent(req.rawBody, signature);
      } catch (err) {
        logger.error('Error al validar firma del webhook de Stripe:', err);
        return errorResponse(res, 400, 'BAD_REQUEST', `Error de firma: ${err.message}`);
      }

      logger.info(`Evento de Webhook Stripe recibido: ${event.type}`);

      if (event.type === 'payment_intent.succeeded') {
        await paymentService.handleWebhookPaymentIntentSucceeded(event.data.object);
      } else if (event.type === 'payment_intent.payment_failed') {
        await paymentService.handleWebhookPaymentIntentFailed(event.data.object);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      logger.error('Error al procesar webhook de Stripe:', err);
      next(err);
    }
  }
}

export default new PaymentController();
