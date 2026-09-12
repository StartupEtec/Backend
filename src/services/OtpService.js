import db from '../database/db.js';
import logger from '../utils/logger.js';

/**
 * NotificationProvider interface — swap this implementation for a real SMS/Email
 * provider (e.g. Twilio, SendGrid, Nodemailer) by replacing the body of `send()`.
 *
 * Integration checklist:
 *  - Twilio SMS: require 'twilio', init client with TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN
 *  - SendGrid Email: require '@sendgrid/mail', set SENDGRID_API_KEY
 *  - Nodemailer: require 'nodemailer', configure SMTP transport via env vars
 *
 * All required env vars should be added to .env.example when a real provider is wired up.
 */
class NotificationProvider {
  /**
   * Sends an OTP notification via Email and/or SMS.
   * @param {{ email?: string, phone?: string }} recipient
   * @param {string} otpCode
   */
  async send({ email, phone }, otpCode) {
    const message = `Tu código de verificación de 2 pasos es: ${otpCode}. Expira en 10 minutos.`;

    // -----------------------------------------------------------------
    // SIMULATION — replace the blocks below with real provider calls.
    // -----------------------------------------------------------------

    if (email) {
      // TODO: replace with real Email provider
      // Example (SendGrid):
      //   await sgMail.send({ to: email, from: 'noreply@app.com',
      //                       subject: 'Código de verificación', text: message });
      logger.info('[OTP] Email OTP enviado (simulación)', { email, message });
    }

    if (phone) {
      // TODO: replace with real SMS provider
      // Example (Twilio):
      //   await twilioClient.messages.create({ body: message, from: TWILIO_FROM, to: phone });
      logger.info('[OTP] SMS OTP enviado (simulación)', { phone, message });
    }
  }
}

const notificationProvider = new NotificationProvider();

class OtpService {
  constructor() {
    this.MAX_OTP_ATTEMPTS = Number.parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
  }

  /**
   * Generates a 6-digit numeric OTP and saves it to the user record with 10-minute expiration.
   * Any OTP request that regenerates the code resets the failed-attempt counter.
   * @param {string} userId - UUID of the user.
   * @returns {Promise<string>} The generated OTP code.
   */
  async generateAndSaveOtp(userId) {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await db('users').where({ id: userId }).update({
      otp_code: otpCode,
      otp_expires_at: expiresAt,
      otp_failed_attempts: 0,
    });

    return otpCode;
  }

  /**
   * Sends OTP to the user via Email and/or SMS using the NotificationProvider.
   * @param {string} email - User email.
   * @param {string} phone - User phone.
   * @param {string} otpCode - Generated OTP code.
   */
  async sendOtp(email, phone, otpCode) {
    await notificationProvider.send({ email, phone }, otpCode);
  }

  /**
   * Validates an OTP for a user. Always returns a structured result so the caller
   * can discriminate the failure reason (explicit error contract):
   *   - { valid: true,  user, reason: null }            → success, OTP cleared + user verified
   *   - { valid: false, user, reason: 'NOT_FOUND' }     → no user matches email/phone
   *   - { valid: false, user, reason: 'EXPIRED' }       → code already expired
   *   - { valid: false, user, reason: 'INVALID' }       → code is wrong (attempt counted)
   *   - { valid: false, user, reason: 'ATTEMPTS_EXCEEDED' } → code invalidated after max attempts
   *
   * After OTP_MAX_ATTEMPTS (default 5) wrong attempts the OTP is invalidated, so a
   * new code must be requested via POST /auth/resend-otp.
   * @param {string} emailOrPhone - User's email or phone number (canonicalised E.164).
   * @param {string} otpCode - The code to verify.
   * @returns {Promise<object>}
   */
  async verifyOtp(emailOrPhone, otpCode) {
    const user = await db('users')
      .where({ email: emailOrPhone })
      .orWhere({ phone: emailOrPhone })
      .first();

    if (!user) {
      logger.warn(`Intento de verificación de OTP para usuario inexistente: ${emailOrPhone}`);
      return { valid: false, user: null, reason: 'NOT_FOUND' };
    }

    const now = new Date();

    // El código ya fue invalidado por exceso de intentos posteriores.
    if (!user.otp_code && Number(user.otp_failed_attempts || 0) >= this.MAX_OTP_ATTEMPTS) {
      return { valid: false, user, reason: 'ATTEMPTS_EXCEEDED' };
    }

    // Comprobamos la expiración antes que la igualdad para no filtrar si el código fue correcto.
    if (user.otp_code && new Date(user.otp_expires_at) < now) {
      logger.warn(`Código OTP expirado para el usuario: ${emailOrPhone}`);
      return { valid: false, user, reason: 'EXPIRED' };
    }

    if (user.otp_code && user.otp_code === otpCode) {
      // Clear OTP fields after successful verification and mark user as verified
      await db('users').where({ id: user.id }).update({
        otp_code: null,
        otp_expires_at: null,
        is_verified: true,
        otp_failed_attempts: 0,
      });

      return { valid: true, user, reason: null };
    }

    const nextAttempts = Number(user.otp_failed_attempts || 0) + 1;
    if (nextAttempts >= this.MAX_OTP_ATTEMPTS) {
      logger.warn(`Código OTP invalidado por exceso de intentos para el usuario: ${emailOrPhone}`);
      await db('users').where({ id: user.id }).update({
        otp_code: null,
        otp_expires_at: null,
        otp_failed_attempts: nextAttempts,
      });
      return { valid: false, user, reason: 'ATTEMPTS_EXCEEDED' };
    }

    logger.warn(`Código OTP incorrecto para el usuario: ${emailOrPhone}`);
    await db('users').where({ id: user.id }).update({
      otp_failed_attempts: nextAttempts,
    });
    return { valid: false, user, reason: 'INVALID' };
  }
}

export default new OtpService();
