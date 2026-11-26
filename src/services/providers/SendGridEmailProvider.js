import logger from '../../utils/logger.js';

/**
 * Proveedor de notificaciones email via SendGrid.
 * Requiere variable de entorno: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL.
 * En desarrollo sin credenciales, simula el envío.
 */
class SendGridEmailProvider {
  constructor() {
    this.initialized = false;
    this.sgMail = null;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@app.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'StartupPlatform';
    this._initPromise = null;
  }

  _ensureInitialized() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._initialize();
    return this._initPromise;
  }

  async _initialize() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      logger.warn('[NOTIFICATION] SendGrid no configurado; emails en modo simulación');
      return;
    }

    try {
      const mod = await import('@sendgrid/mail');
      this.sgMail = mod.default;
      this.sgMail.setApiKey(apiKey);
      this.initialized = true;
      logger.info('[NOTIFICATION] SendGrid inicializado');
    } catch {
      logger.warn('[NOTIFICATION] @sendgrid/mail no instalado; emails en modo simulación');
    }
  }

  /**
   * Envía email de notificación.
   * @param {string} to - Dirección email del destinatario.
   * @param {object} payload - { subject, html, text }.
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async send(to, payload) {
    await this._ensureInitialized();

    if (!this.initialized) {
      logger.info('[NOTIFICATION] Email simulado', { to, subject: payload.subject });
      return { success: true, messageId: `sim_email_${Date.now()}` };
    }

    try {
      const [response] = await this.sgMail.send({
        to,
        from: { email: this.fromEmail, name: this.fromName },
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      return { success: true, messageId: response.headers['x-message-id'] || `sg_${Date.now()}` };
    } catch (err) {
      logger.error('[NOTIFICATION] Error enviando email', { to, error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export default new SendGridEmailProvider();
