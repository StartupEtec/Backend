import logger from '../../utils/logger.js';

/**
 * Proveedor de notificaciones SMS via Twilio.
 * Requiere variables de entorno: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_PHONE.
 * En desarrollo sin credenciales, simula el envío.
 */
class TwilioSMSProvider {
  constructor() {
    this.initialized = false;
    this.client = null;
    this.fromPhone = process.env.TWILIO_FROM_PHONE || '+1234567890';
    this._initPromise = null;
  }

  _ensureInitialized() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._initialize();
    return this._initPromise;
  }

  async _initialize() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      logger.warn('[NOTIFICATION] Twilio no configurado; SMS en modo simulación');
      return;
    }

    try {
      const mod = await import('twilio');
      const twilio = mod.default;
      this.client = twilio(accountSid, authToken);
      this.initialized = true;
      logger.info('[NOTIFICATION] Twilio inicializado');
    } catch {
      logger.warn('[NOTIFICATION] twilio no instalado; SMS en modo simulación');
    }
  }

  /**
   * Envía SMS de notificación.
   * @param {string} to - Número de teléfono del destinatario (E.164).
   * @param {string} body - Contenido del mensaje SMS.
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async send(to, body) {
    await this._ensureInitialized();

    if (!this.initialized) {
      logger.info('[NOTIFICATION] SMS simulado', { to, bodyLength: body?.length });
      return { success: true, messageId: `sim_sms_${Date.now()}` };
    }

    try {
      const message = await this.client.messages.create({
        body,
        from: this.fromPhone,
        to,
      });

      return { success: true, messageId: message.sid };
    } catch (err) {
      logger.error('[NOTIFICATION] Error enviando SMS', { to, error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export default new TwilioSMSProvider();
