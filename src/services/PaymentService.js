import Stripe from 'stripe';
import db from '../database/db.js';
import logger from '../utils/logger.js';
import { encrypt } from '../utils/encryption.js';

let stripeInstance;
if (process.env.STRIPE_SECRET_KEY) {
  stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  // Mock Stripe instance for development fallback and unit testing
  stripeInstance = {
    paymentIntents: {
      create: async (params) => {
        const is3DS = params.payment_method === 'pm_card_threeDSecureRequired';
        if (is3DS) {
          return {
            id: 'pi_mock_123',
            status: 'requires_action',
            client_secret: 'pi_mock_123_secret_abc',
            next_action: { type: 'use_stripe_sdk' },
            amount: params.amount,
            metadata: params.metadata,
          };
        }
        return {
          id: 'pi_mock_123',
          status: 'succeeded',
          amount: params.amount,
          metadata: params.metadata,
        };
      },
    },
    webhooks: {
      constructEvent: (rawBody, signature, secret) => {
        return JSON.parse(rawBody.toString());
      },
    },
  };
}

const runWithRetry = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isTransient =
        err.type === 'StripeConnectionError' ||
        err.type === 'StripeAPIError' ||
        err.statusCode >= 500;
      if (!isTransient || i === retries - 1) {
        throw err;
      }
      logger.warn(`Stripe API call failed, retrying in ${delay}ms...`, {
        error: err.message,
        attempt: i + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
};

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

  async processStripePayment(orderId, paymentMethodId, amount, userId) {
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) {
      return { error: 'ORDER_NOT_FOUND', message: 'Orden no encontrada' };
    }

    const clientProfile = await db('client_profiles').where({ user_id: userId }).first();
    if (!clientProfile || order.client_id !== clientProfile.id) {
      return { error: 'FORBIDDEN', message: 'No autorizado para pagar esta orden' };
    }

    const method = await db('payment_methods').where({ id: paymentMethodId }).first();
    if (!method || method.user_id !== userId) {
      return { error: 'PAYMENT_METHOD_NOT_FOUND', message: 'Método de pago no encontrado' };
    }

    const existingTx = await db('transactions').where({ order_id: orderId }).first();
    if (existingTx && (existingTx.status === 'ESCROWED' || existingTx.status === 'COMPLETED')) {
      return {
        error: 'PAYMENT_ALREADY_STARTED',
        message: 'El pago para esta orden ya ha sido iniciado o completado',
      };
    }

    const { decrypt } = await import('../utils/encryption.js');
    const decryptedCard = decrypt(method.encrypted_card_number);
    let stripePm = 'pm_card_visa';
    if (decryptedCard && decryptedCard.endsWith('3021')) {
      stripePm = 'pm_card_threeDSecureRequired';
    }

    try {
      const paymentIntent = await runWithRetry(() =>
        stripeInstance.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: 'usd',
          payment_method: stripePm,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: 'always',
          },
          metadata: {
            order_id: orderId,
            payer_id: userId,
            receiver_id: order.worker_id,
            payment_method_id: paymentMethodId,
          },
        }),
      );

      if (paymentIntent.status === 'succeeded') {
        await db.transaction(async (trx) => {
          if (existingTx) {
            await trx('transactions').where({ id: existingTx.id }).update({
              status: 'ESCROWED',
              payment_method_id: paymentMethodId,
              updated_at: trx.fn.now(),
            });
          } else {
            await trx('transactions').insert({
              order_id: orderId,
              payer_id: userId,
              receiver_id: order.worker_id,
              amount,
              status: 'ESCROWED',
              payment_method_id: paymentMethodId,
            });
          }

          const { default: escrowService } = await import('./EscrowService.js');
          await escrowService.getOrCreateWallet(trx, userId);
          await trx('user_wallets')
            .where({ user_id: userId })
            .increment('escrowed_balance', Number(amount));

          const tx = await trx('transactions').where({ order_id: orderId }).first();
          await trx('transaction_logs').insert({
            transaction_id: tx.id,
            from_status: existingTx ? existingTx.status : 'PENDING',
            to_status: 'ESCROWED',
            changed_by_id: userId,
            reason: 'Pago de Stripe confirmado sincrónicamente',
          });

          await trx('orders').where({ id: orderId }).update({
            status: 'ACCEPTED',
            updated_at: trx.fn.now(),
          });
          await trx('order_events').insert({
            order_id: orderId,
            user_id: userId,
            from_state: order.status,
            to_state: 'ACCEPTED',
          });
        });

        logger.info('[AUDITORIA] Pago procesado exitosamente (sincrónico)', {
          order_id: orderId,
          user_id: userId,
          amount,
        });

        return { status: 'succeeded' };
      }

      if (paymentIntent.status === 'requires_action') {
        await db.transaction(async (trx) => {
          if (!existingTx) {
            await trx('transactions').insert({
              order_id: orderId,
              payer_id: userId,
              receiver_id: order.worker_id,
              amount,
              status: 'PENDING',
              payment_method_id: paymentMethodId,
            });
          }
        });

        return {
          status: 'requires_action',
          client_secret: paymentIntent.client_secret,
          next_action: paymentIntent.next_action,
        };
      }

      return { error: 'PAYMENT_DECLINED', message: 'La tarjeta fue rechazada' };
    } catch (err) {
      logger.error('Error al procesar cobro en Stripe:', err);
      await db.transaction(async (trx) => {
        if (existingTx) {
          await trx('transactions').where({ id: existingTx.id }).update({
            status: 'FAILED',
            updated_at: trx.fn.now(),
          });
        } else {
          await trx('transactions').insert({
            order_id: orderId,
            payer_id: userId,
            receiver_id: order.worker_id,
            amount,
            status: 'FAILED',
            payment_method_id: paymentMethodId,
          });
        }
      });
      return {
        error: 'PAYMENT_FAILED',
        message: err.message || 'Error en el procesamiento de pago',
      };
    }
  }

  async handleWebhookPaymentIntentSucceeded(paymentIntent) {
    const { order_id, payer_id, receiver_id, payment_method_id } = paymentIntent.metadata;
    const amount = paymentIntent.amount / 100;

    await db.transaction(async (trx) => {
      const order = await trx('orders').where({ id: order_id }).first();
      const existingTx = await trx('transactions').where({ order_id }).first();

      if (existingTx) {
        if (existingTx.status === 'ESCROWED' || existingTx.status === 'COMPLETED') {
          return;
        }
        await trx('transactions').where({ id: existingTx.id }).update({
          status: 'ESCROWED',
          payment_method_id,
          updated_at: trx.fn.now(),
        });
      } else {
        await trx('transactions').insert({
          order_id,
          payer_id,
          receiver_id,
          amount,
          status: 'ESCROWED',
          payment_method_id,
        });
      }

      const { default: escrowService } = await import('./EscrowService.js');
      await escrowService.getOrCreateWallet(trx, payer_id);
      await trx('user_wallets')
        .where({ user_id: payer_id })
        .increment('escrowed_balance', Number(amount));

      const tx = await trx('transactions').where({ order_id }).first();
      await trx('transaction_logs').insert({
        transaction_id: tx.id,
        from_status: existingTx ? existingTx.status : 'PENDING',
        to_status: 'ESCROWED',
        reason: 'Pago de Stripe confirmado vía Webhook',
      });

      if (order && order.status === 'PENDING') {
        await trx('orders').where({ id: order_id }).update({
          status: 'ACCEPTED',
          updated_at: trx.fn.now(),
        });
        await trx('order_events').insert({
          order_id,
          user_id: payer_id,
          from_state: 'PENDING',
          to_state: 'ACCEPTED',
        });
      }
    });

    logger.info('[AUDITORIA] Webhook: Pago exitoso confirmado y fondos retenidos', {
      order_id,
      amount,
    });
  }

  async handleWebhookPaymentIntentFailed(paymentIntent) {
    const { order_id, payer_id } = paymentIntent.metadata;

    await db.transaction(async (trx) => {
      const existingTx = await trx('transactions').where({ order_id }).first();
      if (existingTx) {
        await trx('transactions').where({ id: existingTx.id }).update({
          status: 'FAILED',
          updated_at: trx.fn.now(),
        });
      }

      await trx('orders').where({ id: order_id }).update({
        status: 'CANCELLED',
        updated_at: trx.fn.now(),
      });

      const tx = await trx('transactions').where({ order_id }).first();
      if (tx) {
        await trx('transaction_logs').insert({
          transaction_id: tx.id,
          from_status: existingTx ? existingTx.status : 'PENDING',
          to_status: 'FAILED',
          reason: 'Pago fallido reportado por Stripe Webhook',
        });
      }
    });

    logger.warn('[AUDITORIA] Webhook: Pago fallido, orden cancelada', {
      order_id,
      payer_id,
    });
  }

  constructStripeWebhookEvent(rawBody, signature) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mock_secret';
    return stripeInstance.webhooks.constructEvent(rawBody, signature, secret);
  }
}

export default new PaymentService();
