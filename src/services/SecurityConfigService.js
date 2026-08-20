import bcrypt from 'bcrypt';
import db from '../database/db.js';
import logger from '../utils/logger.js';

class SecurityConfigService {
  /**
   * Cambia la contraseña del usuario.
   */
  async changePassword(userId, { current_password, new_password }) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return { error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    const matches = await bcrypt.compare(current_password, user.password_hash);
    if (!matches) {
      return { error: 'INVALID_CURRENT_PASSWORD', message: 'La contraseña actual es incorrecta' };
    }

    const sameAsOld = await bcrypt.compare(new_password, user.password_hash);
    if (sameAsOld) {
      return {
        error: 'SAME_PASSWORD',
        message: 'La nueva contraseña debe ser diferente a la anterior',
      };
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db('users').where({ id: userId }).update({
      password_hash: newHash,
      updated_at: db.fn.now(),
    });

    logger.info('[AUDITORIA] Contraseña de usuario actualizada', {
      user_id: userId,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Inicia el flujo de cambio de email enviando OTP a ambos emails (actual y nuevo).
   */
  async initEmailChange(userId, { new_email }) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return { error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    if (user.email === new_email) {
      return { error: 'SAME_EMAIL', message: 'El nuevo correo debe ser diferente al actual' };
    }

    const existingUser = await db('users').where({ email: new_email }).first();
    if (existingUser) {
      return { error: 'EMAIL_ALREADY_TAKEN', message: 'El correo electrónico ya está registrado' };
    }

    const currentOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    // Transacción para borrar solicitudes anteriores del mismo tipo del usuario e insertar la nueva
    await db.transaction(async (trx) => {
      await trx('pending_user_changes').where({ user_id: userId, type: 'EMAIL' }).del();
      await trx('pending_user_changes').insert({
        user_id: userId,
        type: 'EMAIL',
        new_value: new_email,
        current_otp_code: currentOtp,
        new_otp_code: newOtp,
        expires_at: expiresAt,
      });
    });

    // Simulación de envío
    logger.info('[OTP] Email OTP actual enviado (simulación)', {
      email: user.email,
      message: `Tu código de verificación para confirmar la desvinculación es: ${currentOtp}. Expira en 10 minutos.`,
    });
    logger.info('[OTP] Email OTP nuevo enviado (simulación)', {
      email: new_email,
      message: `Tu código de verificación para confirmar tu nuevo correo es: ${newOtp}. Expira en 10 minutos.`,
    });

    logger.info('[AUDITORIA] Solicitud de cambio de email iniciada', {
      user_id: userId,
      new_email,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Verifica los OTPs del cambio de email y actualiza el email del usuario.
   */
  async verifyEmailChange(userId, { current_otp_code, new_otp_code }) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return { error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    const pending = await db('pending_user_changes')
      .where({ user_id: userId, type: 'EMAIL' })
      .first();

    if (!pending) {
      return {
        error: 'NO_PENDING_CHANGE',
        message: 'No hay ninguna solicitud de cambio de email pendiente',
      };
    }

    const now = new Date();
    if (new Date(pending.expires_at) < now) {
      await db('pending_user_changes').where({ id: pending.id }).del();
      return { error: 'OTP_EXPIRED', message: 'El código OTP ha expirado' };
    }

    if (pending.current_otp_code !== current_otp_code || pending.new_otp_code !== new_otp_code) {
      return { error: 'INVALID_OTP', message: 'Códigos OTP incorrectos' };
    }

    const oldEmail = user.email;
    const newEmail = pending.new_value;

    // Verificar doblemente que el nuevo correo no haya sido tomado mientras se verificaba
    const existingUser = await db('users').where({ email: newEmail }).first();
    if (existingUser) {
      await db('pending_user_changes').where({ id: pending.id }).del();
      return { error: 'EMAIL_ALREADY_TAKEN', message: 'El correo electrónico ya está registrado' };
    }

    await db.transaction(async (trx) => {
      await trx('users').where({ id: userId }).update({
        email: newEmail,
        updated_at: trx.fn.now(),
      });
      await trx('pending_user_changes').where({ id: pending.id }).del();
    });

    logger.info('[AUDITORIA] Email de usuario actualizado', {
      user_id: userId,
      old_email: oldEmail,
      new_email: newEmail,
      timestamp: new Date().toISOString(),
    });

    return { success: true, new_email: newEmail };
  }

  /**
   * Inicia el flujo de cambio de teléfono enviando OTP a ambos teléfonos (actual y nuevo).
   */
  async initPhoneChange(userId, { new_phone }) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return { error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    if (user.phone === new_phone) {
      return { error: 'SAME_PHONE', message: 'El nuevo teléfono debe ser diferente al actual' };
    }

    const existingUser = await db('users').where({ phone: new_phone }).first();
    if (existingUser) {
      return { error: 'PHONE_ALREADY_TAKEN', message: 'El teléfono ya está registrado' };
    }

    const currentOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await db.transaction(async (trx) => {
      await trx('pending_user_changes').where({ user_id: userId, type: 'PHONE' }).del();
      await trx('pending_user_changes').insert({
        user_id: userId,
        type: 'PHONE',
        new_value: new_phone,
        current_otp_code: currentOtp,
        new_otp_code: newOtp,
        expires_at: expiresAt,
      });
    });

    // Simulación de envío
    logger.info('[OTP] SMS OTP actual enviado (simulación)', {
      phone: user.phone,
      message: `Tu código de verificación para confirmar la desvinculación es: ${currentOtp}. Expira en 10 minutos.`,
    });
    logger.info('[OTP] SMS OTP nuevo enviado (simulación)', {
      phone: new_phone,
      message: `Tu código de verificación para confirmar tu nuevo teléfono es: ${newOtp}. Expira en 10 minutos.`,
    });

    logger.info('[AUDITORIA] Solicitud de cambio de teléfono iniciada', {
      user_id: userId,
      new_phone,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  }

  /**
   * Verifica los OTPs del cambio de teléfono y actualiza el teléfono del usuario.
   */
  async verifyPhoneChange(userId, { current_otp_code, new_otp_code }) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) {
      return { error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };
    }

    const pending = await db('pending_user_changes')
      .where({ user_id: userId, type: 'PHONE' })
      .first();

    if (!pending) {
      return {
        error: 'NO_PENDING_CHANGE',
        message: 'No hay ninguna solicitud de cambio de teléfono pendiente',
      };
    }

    const now = new Date();
    if (new Date(pending.expires_at) < now) {
      await db('pending_user_changes').where({ id: pending.id }).del();
      return { error: 'OTP_EXPIRED', message: 'El código OTP ha expirado' };
    }

    if (pending.current_otp_code !== current_otp_code || pending.new_otp_code !== new_otp_code) {
      return { error: 'INVALID_OTP', message: 'Códigos OTP incorrectos' };
    }

    const oldPhone = user.phone;
    const newPhone = pending.new_value;

    // Verificar doblemente que el nuevo teléfono no haya sido tomado mientras se verificaba
    const existingUser = await db('users').where({ phone: newPhone }).first();
    if (existingUser) {
      await db('pending_user_changes').where({ id: pending.id }).del();
      return { error: 'PHONE_ALREADY_TAKEN', message: 'El teléfono ya está registrado' };
    }

    await db.transaction(async (trx) => {
      await trx('users').where({ id: userId }).update({
        phone: newPhone,
        updated_at: trx.fn.now(),
      });
      await trx('pending_user_changes').where({ id: pending.id }).del();
    });

    logger.info('[AUDITORIA] Teléfono de usuario actualizado', {
      user_id: userId,
      old_phone: oldPhone,
      new_phone: newPhone,
      timestamp: new Date().toISOString(),
    });

    return { success: true, new_phone: newPhone };
  }
}

export default new SecurityConfigService();
