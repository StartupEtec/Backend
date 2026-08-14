import crypto from 'node:crypto';
import db from '../database/db.js';
import logger from '../utils/logger.js';

// Estados de la máquina de transacciones (escrow).
const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  ESCROWED: 'ESCROWED',
  COMPLETED: 'COMPLETED',
  REFUNDED: 'REFUNDED',
  FAILED: 'FAILED',
};

/**
 * Servicio de escrow: retiene fondos del cliente al aceptar una cotización,
 * los libera al completar el servicio y los reembolsa al cancelar.
 *
 * Todas las operaciones son atómicas: reciben una transacción de BD (`trx`)
 * que el llamador (QuoteService / OrderService) inicia, de modo que el pago,
 * el movimiento de wallets y el cambio de estado de la orden comparten
 * el mismo COMMIT/ROLLBACK.
 *
 * El cargo/reembolso a la tarjeta es una SIMULACIÓN del proveedor de pagos
 * (no hay gateway real en esta fase). Con `SIMULATE_CHARGE_FAILURE=true` se
 * fuerza el fallo del cargo para probar el flujo de cancelación automática.
 */
class EscrowService {
  // Simula el cargo al proveedor de pagos (éxito a menos que se fuerce el fallo).
  async chargeCard({ paymentMethodId, amount }) {
    const shouldFail = process.env.SIMULATE_CHARGE_FAILURE === 'true';
    if (!paymentMethodId || shouldFail) {
      return { success: false, reason: 'CARD_DECLINED' };
    }
    return { success: true, providerReference: `mock_charge_${crypto.randomUUID()}` };
  }

  // Simula la devolución a la tarjeta del cliente.
  async refundCard({ paymentMethodId, amount }) {
    if (!paymentMethodId) {
      return { success: false, reason: 'NO_PAYMENT_METHOD' };
    }
    return { success: true, providerReference: `mock_refund_${crypto.randomUUID()}` };
  }

  // Crea la wallet del usuario si aún no existe y devuelve la fila.
  async getOrCreateWallet(trx, userId) {
    let wallet = await trx('user_wallets').where({ user_id: userId }).first();
    if (!wallet) {
      const [created] = await trx('user_wallets')
        .insert({ user_id: userId, current_balance: 0, escrowed_balance: 0 })
        .returning('*');
      wallet = created;
    }
    return wallet;
  }

  // Registra cada cambio de estado en la tabla de auditoría transaction_logs.
  async logStateChange(
    trx,
    { transactionId, fromStatus, toStatus, changedById = null, reason = null },
  ) {
    await trx('transaction_logs').insert({
      transaction_id: transactionId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by_id: changedById,
      reason,
    });
  }

  /**
   * Inicia el escrow al aceptar una cotización (transacción atómica).
   *
   * 1. Crea la transacción en PENDING.
   * 2. Carga la tarjeta del cliente.
   * 3. Éxito → la transacción pasa a ESCROWED y el monto se retiene en la
   *    wallet del cliente (`escrowed_balance`).
   * 4. Fallo → la transacción pasa a FAILED y la orden se cancela
   *    automáticamente.
   */
  async startEscrow(trx, { orderId, payerId, receiverId, amount, paymentMethodId, actorUserId }) {
    const [transaction] = await trx('transactions')
      .insert({
        order_id: orderId,
        payer_id: payerId,
        receiver_id: receiverId,
        amount,
        status: TRANSACTION_STATUS.PENDING,
        payment_method_id: paymentMethodId,
      })
      .returning('*');

    const charge = await this.chargeCard({ paymentMethodId, amount });

    if (!charge.success) {
      await trx('transactions').where({ id: transaction.id }).update({
        status: TRANSACTION_STATUS.FAILED,
        updated_at: trx.fn.now(),
      });
      await trx('orders').where({ id: orderId }).update({
        status: 'CANCELLED',
        updated_at: trx.fn.now(),
      });
      await this.logStateChange(trx, {
        transactionId: transaction.id,
        fromStatus: TRANSACTION_STATUS.PENDING,
        toStatus: TRANSACTION_STATUS.FAILED,
        changedById: actorUserId,
        reason: `Cargo rechazado por el proveedor de pagos (${charge.reason})`,
      });

      logger.warn('[ESCROW] Cargo falló; la orden fue cancelada', {
        order_id: orderId,
        transaction_id: transaction.id,
        payer_id: payerId,
        reason: charge.reason,
        timestamp: new Date().toISOString(),
      });

      return { success: false, transaction, reason: charge.reason };
    }

    await this.getOrCreateWallet(trx, payerId);
    await trx('user_wallets')
      .where({ user_id: payerId })
      .increment('escrowed_balance', Number(amount));
    await trx('transactions').where({ id: transaction.id }).update({
      status: TRANSACTION_STATUS.ESCROWED,
      updated_at: trx.fn.now(),
    });
    await this.logStateChange(trx, {
      transactionId: transaction.id,
      fromStatus: TRANSACTION_STATUS.PENDING,
      toStatus: TRANSACTION_STATUS.ESCROWED,
      changedById: actorUserId,
      reason: 'Cargo exitoso; fondos retenidos en escrow',
    });

    logger.info('[AUDITORIA] Escrow iniciado', {
      transaction_id: transaction.id,
      order_id: orderId,
      payer_id: payerId,
      receiver_id: receiverId,
      amount: Number(amount),
      payment_method_id: paymentMethodId,
      provider_reference: charge.providerReference,
      timestamp: new Date().toISOString(),
    });

    return { success: true, transaction };
  }

  /**
   * Libera los fondos retenidos al completar la orden:
   * debita `escrowed_balance` de la wallet del cliente y acredita
   * `current_balance` en la wallet del trabajador. La transacción pasa a
   * COMPLETED.
   */
  async releaseFunds(trx, { transactionId, actorUserId, reason = 'Servicio completado' }) {
    const transaction = await trx('transactions').where({ id: transactionId }).first();
    if (!transaction) {
      return { error: 'TRANSACTION_NOT_FOUND', message: 'Transacción no encontrada' };
    }
    if (transaction.status !== TRANSACTION_STATUS.ESCROWED) {
      return {
        error: 'INVALID_TRANSITION',
        message: `No se pueden liberar fondos desde ${transaction.status}`,
      };
    }

    await this.getOrCreateWallet(trx, transaction.payer_id);
    await this.getOrCreateWallet(trx, transaction.receiver_id);
    await trx('user_wallets')
      .where({ user_id: transaction.payer_id })
      .decrement('escrowed_balance', Number(transaction.amount));
    await trx('user_wallets')
      .where({ user_id: transaction.receiver_id })
      .increment('current_balance', Number(transaction.amount));
    await trx('transactions').where({ id: transaction.id }).update({
      status: TRANSACTION_STATUS.COMPLETED,
      updated_at: trx.fn.now(),
    });
    await this.logStateChange(trx, {
      transactionId: transaction.id,
      fromStatus: TRANSACTION_STATUS.ESCROWED,
      toStatus: TRANSACTION_STATUS.COMPLETED,
      changedById: actorUserId,
      reason,
    });

    logger.info('[AUDITORIA] Escrow liberado', {
      transaction_id: transaction.id,
      order_id: transaction.order_id,
      payer_id: transaction.payer_id,
      receiver_id: transaction.receiver_id,
      amount: Number(transaction.amount),
      timestamp: new Date().toISOString(),
    });

    return { transaction };
  }

  /**
   * Reembolsa al cliente al cancelar la orden: simula la devolución a la
   * tarjeta, libera la retención de la wallet del cliente y pasa la
   * transacción a REFUNDED.
   */
  async refund(trx, { transactionId, actorUserId, reason = 'Orden cancelada' }) {
    const transaction = await trx('transactions').where({ id: transactionId }).first();
    if (!transaction) {
      return { error: 'TRANSACTION_NOT_FOUND', message: 'Transacción no encontrada' };
    }
    if (transaction.status !== TRANSACTION_STATUS.ESCROWED) {
      return {
        error: 'INVALID_TRANSITION',
        message: `Solo se puede reembolsar desde ESCROWED (actual: ${transaction.status})`,
      };
    }

    const refundResult = await this.refundCard({
      paymentMethodId: transaction.payment_method_id,
      amount: transaction.amount,
    });
    if (!refundResult.success) {
      return { error: 'REFUND_FAILED', message: 'No se pudo reembolsar a la tarjeta del cliente' };
    }

    await this.getOrCreateWallet(trx, transaction.payer_id);
    await trx('user_wallets')
      .where({ user_id: transaction.payer_id })
      .decrement('escrowed_balance', Number(transaction.amount));
    await trx('transactions').where({ id: transaction.id }).update({
      status: TRANSACTION_STATUS.REFUNDED,
      updated_at: trx.fn.now(),
    });
    await this.logStateChange(trx, {
      transactionId: transaction.id,
      fromStatus: TRANSACTION_STATUS.ESCROWED,
      toStatus: TRANSACTION_STATUS.REFUNDED,
      changedById: actorUserId,
      reason,
    });

    logger.info('[AUDITORIA] Reembolso emitido', {
      transaction_id: transaction.id,
      order_id: transaction.order_id,
      payer_id: transaction.payer_id,
      amount: Number(transaction.amount),
      provider_reference: refundResult.providerReference,
      timestamp: new Date().toISOString(),
    });

    return { transaction, refundReference: refundResult.providerReference };
  }
}

export default new EscrowService();
