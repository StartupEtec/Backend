import db from '../database/db.js';
import logger from '../utils/logger.js';
import firebasePushProvider from './providers/FirebasePushProvider.js';
import sendGridEmailProvider from './providers/SendGridEmailProvider.js';
import twilioSMSProvider from './providers/TwilioSMSProvider.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Plantillas de notificación por tipo de evento
const NOTIFICATION_TEMPLATES = {
  SERVICE_REQUEST: {
    title: 'Nueva solicitud de servicio',
    body: (data) =>
      `Tienes una nueva solicitud de servicio en la categoría "${data.category_name || 'general'}".`,
    pushBody: (data) => `Nueva solicitud: ${data.category_name || 'Servicio'}`,
  },
  QUOTE_RECEIVED: {
    title: 'Cotización recibida',
    body: (data) => `Has recibido una cotización de $${data.price || ''} para tu orden.`,
    pushBody: (data) => `Nueva cotización: $${data.price || ''}`,
  },
  QUOTE_ACCEPTED: {
    title: 'Cotización aceptada',
    body: (data) =>
      `Tu cotización de $${data.price || ''} ha sido aceptada. El pago está en escrow.`,
    pushBody: (data) => `Cotización aceptada: $${data.price || ''}`,
  },
  SERVICE_COMPLETED: {
    title: 'Servicio completado',
    body: () => 'El servicio ha sido completado y confirmado por ambas partes.',
    pushBody: () => 'Servicio completado',
  },
  NEW_MESSAGE: {
    title: 'Nuevo mensaje',
    body: (data) => `${data.sender_name || 'Alguien'} te envió un mensaje.`,
    pushBody: (data) => `${data.sender_name || 'Alguien'}: ${data.preview || 'Nuevo mensaje'}`,
  },
  ORDER_STATUS_CHANGE: {
    title: 'Estado de orden actualizado',
    body: (data) =>
      `Tu orden ha cambiado de estado: ${data.old_status || ''} → ${data.new_status || ''}.`,
    pushBody: (data) => `Orden: ${data.new_status || 'Actualizada'}`,
  },
};

// Mapeo de tipos a plantillas de email
const EMAIL_TEMPLATES = {
  SERVICE_REQUEST: (data) => ({
    subject: 'Nueva solicitud de servicio - StartupPlatform',
    html: `<h2>Nueva solicitud de servicio</h2><p>Se ha recibido una nueva solicitud en la categoría <strong>${data.category_name || 'general'}</strong>.</p>`,
  }),
  QUOTE_RECEIVED: (data) => ({
    subject: 'Cotización recibida - StartupPlatform',
    html: `<h2>Cotización recibida</h2><p>Has recibido una cotización de <strong>$${data.price || ''}</strong> para tu orden.</p>`,
  }),
  QUOTE_ACCEPTED: (data) => ({
    subject: 'Cotización aceptada - StartupPlatform',
    html: `<h2>Cotización aceptada</h2><p>Tu cotización de <strong>$${data.price || ''}</strong> ha sido aceptada.</p><p>El pago está siendo procesado en escrow.</p>`,
  }),
  SERVICE_COMPLETED: () => ({
    subject: 'Servicio completado - StartupPlatform',
    html: `<h2>Servicio completado</h2><p>El servicio ha sido completado y confirmado por ambas partes.</p>`,
  }),
  NEW_MESSAGE: (data) => ({
    subject: `Nuevo mensaje de ${data.sender_name || 'alguien'} - StartupPlatform`,
    html: `<h2>Nuevo mensaje</h2><p>${data.sender_name || 'Alguien'} te ha enviado un mensaje.</p>`,
  }),
  ORDER_STATUS_CHANGE: (data) => ({
    subject: 'Estado de orden actualizado - StartupPlatform',
    html: `<h2>Estado actualizado</h2><p>Tu orden ha cambiado: <strong>${data.old_status || ''}</strong> → <strong>${data.new_status || ''}</strong>.</p>`,
  }),
};

class NotificationService {
  /**
   * Crea las preferencias de notificación por defecto para un usuario.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async createDefaultPreferences(userId) {
    const [existing] = await db('notification_preferences').where({ user_id: userId });
    if (existing) return existing;

    const [prefs] = await db('notification_preferences').insert({ user_id: userId }).returning('*');
    return prefs;
  }

  /**
   * Obtiene las preferencias de notificación de un usuario.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getPreferences(userId) {
    let prefs = await db('notification_preferences').where({ user_id: userId }).first();
    if (!prefs) {
      prefs = await this.createDefaultPreferences(userId);
    }
    return prefs;
  }

  /**
   * Actualiza las preferencias de notificación de un usuario.
   * @param {string} userId
   * @param {object} data - Campos a actualizar.
   * @returns {Promise<object>}
   */
  async updatePreferences(userId, data) {
    await this.createDefaultPreferences(userId);

    const [updated] = await db('notification_preferences')
      .where({ user_id: userId })
      .update({ ...data, updated_at: db.fn.now() })
      .returning('*');

    logger.info('[AUDITORIA] Preferencias de notificación actualizadas', {
      user_id: userId,
      timestamp: new Date().toISOString(),
    });

    return updated;
  }

  /**
   * Verifica si el usuario tiene notificaciones habilitadas para el canal dado.
   * @param {object} prefs - Preferencias del usuario.
   * @param {string} channel - Canal a verificar (push, email, sms).
   * @returns {boolean}
   */
  isChannelEnabled(prefs, channel) {
    if (channel === 'push') return prefs.push_enabled;
    if (channel === 'email') return prefs.email_enabled;
    if (channel === 'sms') return prefs.sms_enabled;
    return false;
  }

  /**
   * Verifica si el usuario está en horario de no molestar.
   * @param {object} prefs - Preferencias del usuario.
   * @returns {boolean}
   */
  isInDNDPeriod(prefs) {
    if (!prefs.dnd_enabled || !prefs.dnd_start || !prefs.dnd_end) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = prefs.dnd_start.split(':').map(Number);
    const [endH, endM] = prefs.dnd_end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
    // Horario cruza medianoche (ej: 22:00 - 06:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  /**
   * Envía notificación push a todos los tokens registrados del usuario.
   * @param {string} userId
   * @param {object} payload - { title, body, data }
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendPush(userId, payload) {
    // Por ahora usa un token ficticio; en producción se consultaría una tabla de dispositivos
    const token = await this.getDeviceToken(userId);
    if (!token) {
      return { success: false, error: 'NO_DEVICE_TOKEN' };
    }
    return firebasePushProvider.send(token, payload);
  }

  /**
   * Envía email al usuario.
   * @param {string} userId
   * @param {object} payload - { subject, html, text }
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendEmail(userId, payload) {
    const user = await db('users').where({ id: userId }).first();
    if (!user?.email) {
      return { success: false, error: 'NO_EMAIL' };
    }
    return sendGridEmailProvider.send(user.email, payload);
  }

  /**
   * Envía SMS al usuario.
   * @param {string} userId
   * @param {string} body
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async sendSMS(userId, body) {
    const user = await db('users').where({ id: userId }).first();
    if (!user?.phone) {
      return { success: false, error: 'NO_PHONE' };
    }
    return twilioSMSProvider.send(user.phone, body);
  }

  /**
   * Obtiene el token de dispositivo del usuario (placeholder).
   * En producción, se consultaría una tabla `user_devices` con tokens FCM.
   * @param {string} userId
   * @returns {Promise<string|null>}
   */
  async getDeviceToken(userId) {
    // TODO: Implementar tabla user_devices para almacenar tokens FCM
    return null;
  }

  /**
   * Método principal: envía una notificación a un usuario por los canales indicados.
   * @param {string} userId - ID del usuario destinatario.
   * @param {string} type - Tipo de notificación (debe existir en NOTIFICATION_TEMPLATES).
   * @param {object} data - Datos del evento para personalizar el contenido.
   * @param {string[]} [channels] - Canales override. Si no se provee, se usan las preferencias.
   * @returns {Promise<object>} - Registro de notificación creado.
   */
  async send(userId, type, data = {}, channels = null) {
    try {
      const template = NOTIFICATION_TEMPLATES[type];
      if (!template) {
        logger.warn('[NOTIFICATION] Tipo de notificación desconocido', { type });
        return null;
      }

      const prefs = await this.getPreferences(userId);

      // Si está en horario de no molestar, no enviar (excepto SERVICE_COMPLETED y ORDER_STATUS_CHANGE)
      const isDND = this.isInDNDPeriod(prefs);
      const bypassDND = ['SERVICE_COMPLETED', 'ORDER_STATUS_CHANGE'].includes(type);

      if (isDND && !bypassDND) {
        logger.info('[NOTIFICATION] Usuario en DND; notificación pospuesta', {
          user_id: userId,
          type,
        });
        // Registrar como PENDING para enviar después
        return this._createNotificationRecord(
          userId,
          type,
          data,
          ['push', 'email', 'sms'],
          'PENDING',
        );
      }

      // Determinar canales a usar
      const targetChannels =
        Array.isArray(channels) && channels.length > 0 ? channels : ['push', 'email', 'sms'];
      const enabledChannels = targetChannels.filter((ch) => this.isChannelEnabled(prefs, ch));

      if (enabledChannels.length === 0) {
        logger.info('[NOTIFICATION] Ningún canal habilitado', { user_id: userId, type });
        return this._createNotificationRecord(userId, type, data, [], 'PENDING');
      }

      // Crear registro de notificación
      const notification = await this._createNotificationRecord(
        userId,
        type,
        data,
        enabledChannels,
        'PENDING',
      );

      // Despachar en paralelo a los canales habilitados
      const results = await Promise.allSettled(
        enabledChannels.map((channel) =>
          this._dispatchToChannel(userId, channel, type, data, template),
        ),
      );

      // Evaluar resultados
      const failedChannels = [];
      const succeededChannels = [];

      results.forEach((result, index) => {
        const channel = enabledChannels[index];
        if (result.status === 'fulfilled' && result.value.success) {
          succeededChannels.push(channel);
        } else {
          failedChannels.push(channel);
        }
      });

      // Actualizar estado de la notificación
      const finalStatus =
        failedChannels.length === 0 ? 'SENT' : succeededChannels.length > 0 ? 'SENT' : 'FAILED';
      const updateData = { status: finalStatus };

      if (failedChannels.length > 0 && succeededChannels.length === 0) {
        updateData.failed_reason = results
          .filter((r) => r.status === 'rejected' || !r.value?.success)
          .map((r) => r.reason?.message || r.value?.error || 'unknown')
          .join('; ');
        updateData.retry_count = (notification.retry_count || 0) + 1;
      }

      await db('notifications')
        .where({ id: notification.id })
        .update({ ...updateData, updated_at: db.fn.now() });

      logger.info('[NOTIFICATION] Notificación procesada', {
        notification_id: notification.id,
        user_id: userId,
        type,
        channels: enabledChannels,
        succeeded: succeededChannels,
        failed: failedChannels,
        timestamp: new Date().toISOString(),
      });

      return { ...notification, ...updateData };
    } catch (err) {
      logger.error('[NOTIFICATION] Error en send()', { user_id: userId, type, error: err.message });
      return null;
    }
  }

  /**
   * Despacha la notificación a un canal específico.
   * @private
   */
  async _dispatchToChannel(userId, channel, type, data, template) {
    switch (channel) {
      case 'push':
        return this.sendPush(userId, {
          title: template.title,
          body: template.pushBody(data),
          data: { type, ...data },
        });

      case 'email': {
        const emailTemplate = EMAIL_TEMPLATES[type]?.(data);
        if (!emailTemplate) return { success: false, error: 'NO_EMAIL_TEMPLATE' };
        return this.sendEmail(userId, emailTemplate);
      }

      case 'sms':
        return this.sendSMS(userId, template.pushBody(data));

      default:
        return { success: false, error: `UNKNOWN_CHANNEL: ${channel}` };
    }
  }

  /**
   * Crea el registro de notificación en base de datos.
   * @private
   */
  async _createNotificationRecord(userId, type, data, channels, status) {
    const template = NOTIFICATION_TEMPLATES[type];
    const [notification] = await db('notifications')
      .insert({
        user_id: userId,
        type,
        channels: JSON.stringify(channels),
        title: template.title,
        body: template.body(data),
        data: JSON.stringify(data),
        status,
      })
      .returning('*');
    return notification;
  }

  /**
   * Reintenta notificaciones fallidas.
   * @param {number} [maxAge=3600000] - Edad máxima en ms para reintentar (default: 1 hora).
   * @returns {Promise<number>} - Cantidad de notificaciones reintentadas.
   */
  async retryFailed(maxAge = 3600000) {
    const cutoff = new Date(Date.now() - maxAge);
    const failedNotifications = await db('notifications')
      .where({ status: 'FAILED' })
      .where('retry_count', '<', db.raw('max_retries'))
      .where('created_at', '>=', cutoff)
      .select('*');

    let retriedCount = 0;

    for (const notification of failedNotifications) {
      try {
        const channels = Array.isArray(notification.channels)
          ? notification.channels
          : JSON.parse(notification.channels || '[]');
        const data =
          typeof notification.data === 'object'
            ? notification.data
            : JSON.parse(notification.data || '{}');

        const template = NOTIFICATION_TEMPLATES[notification.type];
        if (!template) continue;

        const prefs = await this.getPreferences(notification.user_id);
        const enabledChannels = channels.filter((ch) => this.isChannelEnabled(prefs, ch));

        if (enabledChannels.length === 0) continue;

        const results = await Promise.allSettled(
          enabledChannels.map((ch) =>
            this._dispatchToChannel(notification.user_id, ch, notification.type, data, template),
          ),
        );

        const allSucceeded = results.every((r) => r.status === 'fulfilled' && r.value?.success);

        await db('notifications')
          .where({ id: notification.id })
          .update({
            status: allSucceeded ? 'SENT' : 'FAILED',
            retry_count: notification.retry_count + 1,
            failed_reason: allSucceeded
              ? null
              : results
                  .filter((r) => r.status === 'rejected' || !r.value?.success)
                  .map((r) => r.reason?.message || r.value?.error || 'unknown')
                  .join('; '),
            updated_at: db.fn.now(),
          });

        retriedCount++;
      } catch (err) {
        logger.error('[NOTIFICATION] Error reintentando notificación', {
          notification_id: notification.id,
          error: err.message,
        });
      }
    }

    return retriedCount;
  }

  /**
   * Lista notificaciones de un usuario con paginación.
   * @param {string} userId
   * @param {object} options - { limit, offset, status, type }
   * @returns {Promise<{notifications: object[], count: number, total: number}>}
   */
  async listNotifications(userId, { limit = DEFAULT_LIMIT, offset = 0, status, type } = {}) {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

    let query = db('notifications').where({ user_id: userId });
    let countQuery = db('notifications').where({ user_id: userId });

    if (status) {
      query = query.where({ status });
      countQuery = countQuery.where({ status });
    }
    if (type) {
      query = query.where({ type });
      countQuery = countQuery.where({ type });
    }

    const [{ count: total }] = await countQuery.count('* as count');

    const notifications = await query.orderBy('created_at', 'desc').limit(safeLimit).offset(offset);

    return {
      notifications: notifications.map((n) => ({
        ...n,
        channels: typeof n.channels === 'string' ? JSON.parse(n.channels) : n.channels,
        data: typeof n.data === 'string' ? JSON.parse(n.data) : n.data,
      })),
      count: notifications.length,
      total: Number(total),
      limit: safeLimit,
      offset,
    };
  }

  /**
   * Obtiene el conteo de notificaciones no leídas de un usuario.
   * @param {string} userId
   * @returns {Promise<number>}
   */
  async getUnreadCount(userId) {
    const [{ count }] = await db('notifications')
      .where({ user_id: userId })
      .whereNot({ status: 'READ' })
      .count('* as count');
    return Number(count);
  }

  /**
   * Marca una notificación como leída.
   * @param {string} notificationId
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async markAsRead(notificationId, userId) {
    const notification = await db('notifications')
      .where({ id: notificationId, user_id: userId })
      .first();

    if (!notification) return null;

    const [updated] = await db('notifications')
      .where({ id: notificationId })
      .update({ status: 'READ', read_at: new Date(), updated_at: db.fn.now() })
      .returning('*');

    return {
      ...updated,
      channels:
        typeof updated.channels === 'string' ? JSON.parse(updated.channels) : updated.channels,
      data: typeof updated.data === 'string' ? JSON.parse(updated.data) : updated.data,
    };
  }

  /**
   * Marca todas las notificaciones de un usuario como leídas.
   * @param {string} userId
   * @returns {Promise<number>} - Cantidad de notificaciones actualizadas.
   */
  async markAllAsRead(userId) {
    const count = await db('notifications')
      .where({ user_id: userId })
      .whereNot({ status: 'READ' })
      .update({ status: 'READ', read_at: new Date(), updated_at: db.fn.now() });

    logger.info('[AUDITORIA] Todas las notificaciones marcadas como leídas', {
      user_id: userId,
      count,
      timestamp: new Date().toISOString(),
    });

    return count;
  }
}

export default new NotificationService();
