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
  /**
   * Generates a 6-digit numeric OTP and saves it to the user record with 10-minute expiration.
   * @param {string} userId - UUID of the user.
   * @returns {Promise<string>} The generated OTP code.
   */
  async generateAndSaveOtp(userId) {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await db('users').where({ id: userId }).update({
      otp_code: otpCode,
      otp_expires_at: expiresAt,
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
   * Validates OTP for a user. On success, clears OTP fields and marks user as verified.
   * @param {string} emailOrPhone - User's email or phone number.
   * @param {string} otpCode - The code to verify.
   * @returns {Promise<object|null>} The user object if valid, null otherwise.
   */
  async verifyOtp(emailOrPhone, otpCode) {
    const user = await db('users')
      .where({ email: emailOrPhone })
      .orWhere({ phone: emailOrPhone })
      .first();

    if (!user) {
      logger.warn(`Intento de verificación de OTP para usuario inexistente: ${emailOrPhone}`);
      return null;
    }

    if (!user.otp_code || user.otp_code !== otpCode) {
      logger.warn(`Código OTP incorrecto para el usuario: ${emailOrPhone}`);
      return null;
    }

    const now = new Date();
    if (new Date(user.otp_expires_at) < now) {
      logger.warn(`Código OTP expirado para el usuario: ${emailOrPhone}`);
      return null;
    }

    // Clear OTP fields after successful verification and mark user as verified
    await db('users').where({ id: user.id }).update({
      otp_code: null,
      otp_expires_at: null,
      is_verified: true,
    });

    return user;
  }
}

export default new OtpService();
