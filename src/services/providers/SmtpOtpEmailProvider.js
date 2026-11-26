import nodemailer from 'nodemailer';
import logger from '../../utils/logger.js';

class SmtpOtpEmailProvider {
  constructor() {
    this.transporter = null;
  }

  _getTransporter() {
    if (this.transporter) return this.transporter;

    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!user || !pass) {
      throw new Error('SMTP_USER y SMTP_PASS son requeridos');
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mx.laborin.app',
      port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
      tls: { minVersion: 'TLSv1.2' },
    });

    return this.transporter;
  }

  async send(to, payload) {
    try {
      const info = await this._getTransporter().sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      });
      logger.info('[OTP] Email OTP enviado por SMTP', { to, messageId: info.messageId });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.error('[OTP] Error enviando email por SMTP', { to, error: err.message });
      throw err;
    }
  }
}

export default new SmtpOtpEmailProvider();
