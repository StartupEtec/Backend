import db from '../database/db.js';
import logger from '../utils/logger.js';
import { encrypt } from '../utils/encryption.js';

const detectCardBrand = (cardNumber) => {
  if (cardNumber.startsWith('4')) return 'Visa';
  if (
    /^5[1-5]/.test(cardNumber) ||
    /^2(22[1-9]|2[3-9][0-9]|[3-6][0-9]{2}|7[0-1][0-9]|720)/.test(cardNumber)
  ) {
    return 'Mastercard';
  }
  if (/^3[47]/.test(cardNumber)) return 'American Express';
  return 'Other';
};

const maskCardNumber = (cardNumber) => {
  const last4 = cardNumber.slice(-4);
  return `**** **** **** ${last4}`;
};

class PaymentService {
  async listUserPaymentMethods(userId) {
    const methods = await db('payment_methods')
      .where({ user_id: userId })
      .orderBy('is_primary', 'desc')
      .orderBy('created_at', 'desc');

    return methods.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      card_number_masked: row.card_number_masked,
      card_brand: row.card_brand,
      exp_month: row.exp_month,
      exp_year: row.exp_year,
      cardholder_name: row.cardholder_name,
      is_primary: row.is_primary,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async createPaymentMethod(userId, data) {
    const { card_number, cvv, exp_month, exp_year, cardholder_name, is_primary } = data;

    // Check limits
    const [{ count }] = await db('payment_methods').where({ user_id: userId }).count('id as count');

    if (parseInt(count, 10) >= 10) {
      return {
        error: 'LIMIT_EXCEEDED',
        message: 'El usuario ya tiene el máximo de 10 métodos de pago',
      };
    }

    const cardBrand = detectCardBrand(card_number);
    const maskedNumber = maskCardNumber(card_number);
    const encryptedCard = encrypt(card_number);

    // If it's the first card, force it to be primary
    const shouldBePrimary = parseInt(count, 10) === 0 || is_primary === true;

    const result = await db.transaction(async (trx) => {
      if (shouldBePrimary) {
        // Set all others to false
        await trx('payment_methods').where({ user_id: userId }).update({ is_primary: false });
      }

      const [newMethod] = await trx('payment_methods')
        .insert({
          user_id: userId,
          card_number_masked: maskedNumber,
          card_brand: cardBrand,
          exp_month,
          exp_year,
          cardholder_name,
          encrypted_card_number: encryptedCard,
          is_primary: shouldBePrimary,
        })
        .returning('*');

      logger.info('[AUDITORIA] Método de pago agregado', {
        payment_method_id: newMethod.id,
        user_id: userId,
        card_brand: cardBrand,
        card_number_masked: maskedNumber,
        is_primary: shouldBePrimary,
      });

      return newMethod;
    });

    return {
      paymentMethod: {
        id: result.id,
        user_id: result.user_id,
        card_number_masked: result.card_number_masked,
        card_brand: result.card_brand,
        exp_month: result.exp_month,
        exp_year: result.exp_year,
        cardholder_name: result.cardholder_name,
        is_primary: result.is_primary,
        created_at: result.created_at,
        updated_at: result.updated_at,
      },
    };
  }

  async updatePaymentMethod(id, userId, data) {
    const method = await db('payment_methods').where({ id }).first();
    if (!method) {
      return { error: 'PAYMENT_METHOD_NOT_FOUND', message: 'Método de pago no encontrado' };
    }

    if (method.user_id !== userId) {
      return { error: 'FORBIDDEN', message: 'No autorizado para actualizar este método de pago' };
    }

    const updateFields = {};
    if (data.exp_month !== undefined) updateFields.exp_month = data.exp_month;
    if (data.exp_year !== undefined) updateFields.exp_year = data.exp_year;
    if (data.cardholder_name !== undefined) updateFields.cardholder_name = data.cardholder_name;

    const result = await db.transaction(async (trx) => {
      if (data.is_primary === true && !method.is_primary) {
        // Toggle primary card
        await trx('payment_methods').where({ user_id: userId }).update({ is_primary: false });
        updateFields.is_primary = true;
      } else if (data.is_primary === false && method.is_primary) {
        // We cannot unset primary card if it is the only one.
        const [{ count }] = await trx('payment_methods')
          .where({ user_id: userId })
          .count('id as count');
        if (parseInt(count, 10) > 1) {
          // Find another card to make primary
          const another = await trx('payment_methods')
            .where({ user_id: userId })
            .whereNot({ id })
            .orderBy('created_at', 'asc')
            .first();
          if (another) {
            await trx('payment_methods').where({ id: another.id }).update({ is_primary: true });
          }
          updateFields.is_primary = false;
        }
      }

      if (Object.keys(updateFields).length > 0) {
        updateFields.updated_at = trx.fn.now();
        await trx('payment_methods').where({ id }).update(updateFields);
      }

      logger.info('[AUDITORIA] Método de pago actualizado', {
        payment_method_id: id,
        user_id: userId,
        updated_fields: Object.keys(updateFields),
      });

      return trx('payment_methods').where({ id }).first();
    });

    return {
      paymentMethod: {
        id: result.id,
        user_id: result.user_id,
        card_number_masked: result.card_number_masked,
        card_brand: result.card_brand,
        exp_month: result.exp_month,
        exp_year: result.exp_year,
        cardholder_name: result.cardholder_name,
        is_primary: result.is_primary,
        created_at: result.created_at,
        updated_at: result.updated_at,
      },
    };
  }

  async deletePaymentMethod(id, userId) {
    const method = await db('payment_methods').where({ id }).first();
    if (!method) {
      return { error: 'PAYMENT_METHOD_NOT_FOUND', message: 'Método de pago no encontrado' };
    }

    if (method.user_id !== userId) {
      return { error: 'FORBIDDEN', message: 'No autorizado para eliminar este método de pago' };
    }

    // Check for pending transactions
    const pendingTransactions = await db('transactions')
      .where({ payment_method_id: id })
      .whereIn('status', ['PENDING', 'ESCROWED']);

    if (pendingTransactions.length > 0) {
      return {
        error: 'PENDING_TRANSACTIONS',
        message: 'No se puede eliminar el método de pago porque tiene transacciones pendientes',
      };
    }

    await db.transaction(async (trx) => {
      // Delete method
      await trx('payment_methods').where({ id }).del();

      // If deleted card was primary, make another one primary
      if (method.is_primary) {
        const another = await trx('payment_methods')
          .where({ user_id: userId })
          .orderBy('created_at', 'asc')
          .first();
        if (another) {
          await trx('payment_methods').where({ id: another.id }).update({ is_primary: true });
        }
      }

      logger.info('[AUDITORIA] Método de pago eliminado', {
        payment_method_id: id,
        user_id: userId,
      });
    });

    return { success: true };
  }
}

export default new PaymentService();
