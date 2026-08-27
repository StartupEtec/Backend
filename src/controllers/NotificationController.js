import notificationService from '../services/NotificationService.js';
import logger from '../utils/logger.js';
import {
  updateNotificationPreferencesSchema,
  listNotificationsSchema,
} from '../utils/validation.js';

function errorResponse(res, statusCode, error, message) {
  return res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });
}

class NotificationController {
  /**
   * GET /api/v1/notifications
   * Lista notificaciones del usuario autenticado.
   */
  async listNotifications(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { error, value } = listNotificationsSchema.validate(req.query);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await notificationService.listNotifications(userId, {
        limit: value.limit,
        offset: value.offset,
        status: value.status,
        type: value.type,
      });

      return res.status(200).json(result);
    } catch (err) {
      logger.error('[NOTIFICATION] Error listando notificaciones', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Retorna el conteo de notificaciones no leídas.
   */
  async getUnreadCount(req, res, next) {
    try {
      const userId = req.user.user_id;
      const count = await notificationService.getUnreadCount(userId);
      return res.status(200).json({ unread_count: count });
    } catch (err) {
      logger.error('[NOTIFICATION] Error obteniendo conteo no leídas', { error: err.message });
      next(err);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Marca una notificación específica como leída.
   */
  async markAsRead(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { id } = req.params;

      const updated = await notificationService.markAsRead(id, userId);
      if (!updated) {
        return errorResponse(res, 404, 'NOTIFICATION_NOT_FOUND', 'Notificación no encontrada');
      }

      return res.status(200).json({ notification: updated });
    } catch (err) {
      logger.error('[NOTIFICATION] Error marcando notificación como leída', { error: err.message });
      next(err);
    }
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Marca todas las notificaciones del usuario como leídas.
   */
  async markAllAsRead(req, res, next) {
    try {
      const userId = req.user.user_id;
      const count = await notificationService.markAllAsRead(userId);
      return res.status(200).json({ marked_count: count });
    } catch (err) {
      logger.error('[NOTIFICATION] Error marcando todas como leídas', { error: err.message });
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications/preferences
   * Obtiene las preferencias de notificación del usuario.
   */
  async getPreferences(req, res, next) {
    try {
      const userId = req.user.user_id;
      const prefs = await notificationService.getPreferences(userId);
      return res.status(200).json({ preferences: prefs });
    } catch (err) {
      logger.error('[NOTIFICATION] Error obteniendo preferencias', { error: err.message });
      next(err);
    }
  }

  /**
   * PATCH /api/v1/notifications/preferences
   * Actualiza las preferencias de notificación del usuario.
   */
  async updatePreferences(req, res, next) {
    try {
      const userId = req.user.user_id;
      const { error, value } = updateNotificationPreferencesSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const updated = await notificationService.updatePreferences(userId, value);
      return res.status(200).json({ preferences: updated });
    } catch (err) {
      logger.error('[NOTIFICATION] Error actualizando preferencias', { error: err.message });
      next(err);
    }
  }

  /**
   * POST /api/v1/notifications/test
   * Envía una notificación de prueba (solo en desarrollo).
   */
  async sendTestNotification(req, res, next) {
    try {
      if (process.env.NODE_ENV === 'production') {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'Las notificaciones de prueba no están disponibles en producción',
        );
      }

      const userId = req.user.user_id;
      const { type = 'ORDER_STATUS_CHANGE', channels } = req.body;

      const notification = await notificationService.send(
        userId,
        type,
        {
          old_status: 'PENDING',
          new_status: 'ACCEPTED',
          order_id: 'test-order-id',
        },
        channels,
      );

      return res.status(201).json({ notification });
    } catch (err) {
      logger.error('[NOTIFICATION] Error enviando notificación de prueba', { error: err.message });
      next(err);
    }
  }
}

export default new NotificationController();
