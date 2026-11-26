import db from '../database/db.js';
import logger from '../utils/logger.js';
import websocketHub from '../utils/websocket.js';
import escrowService from './EscrowService.js';

class DisputeService {
  async createDispute(userId, { orderId, reason, evidenceUrl }) {
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) {
      return { error: 'ORDER_NOT_FOUND', message: 'Orden no encontrada' };
    }

    const [clientProfile, workerProfile] = await Promise.all([
      db('client_profiles').where({ id: order.client_id }).first(),
      db('worker_profiles').where({ id: order.worker_id }).first(),
    ]);

    if (!clientProfile || !workerProfile) {
      return { error: 'MISSING_ORDER_PARTICIPANTS', message: 'Faltan participantes de la orden' };
    }

    const isClient = clientProfile.user_id === userId;
    const isWorker = workerProfile.user_id === userId;

    if (!isClient && !isWorker) {
      return {
        error: 'FORBIDDEN',
        message: 'Solo el cliente o el trabajador de la orden pueden abrir una disputa',
      };
    }

    if (order.status !== 'COMPLETED' && order.status !== 'CANCELLED') {
      return {
        error: 'INVALID_ORDER_STATUS',
        message: 'La orden debe estar en estado COMPLETED o CANCELLED para poder abrir una disputa',
      };
    }

    const existing = await db('disputes').where({ order_id: orderId }).first();
    if (existing) {
      return {
        error: 'DISPUTE_ALREADY_EXISTS',
        message: 'Ya existe una disputa para esta orden',
      };
    }

    const [dispute] = await db('disputes')
      .insert({
        order_id: orderId,
        opened_by_id: userId,
        reason,
        evidence_url: evidenceUrl || null,
        status: 'OPEN',
      })
      .returning('*');

    logger.info('[AUDITORIA] Disputa abierta', {
      dispute_id: dispute.id,
      order_id: orderId,
      opened_by_id: userId,
      timestamp: new Date().toISOString(),
    });

    const notifyUserIds = [clientProfile.user_id, workerProfile.user_id];
    websocketHub.sendToUsers(notifyUserIds, 'dispute:created', {
      dispute_id: dispute.id,
      order_id: orderId,
      status: 'OPEN',
    });

    return { dispute };
  }

  async listDisputes(userId, role, query) {
    const { limit, offset } = query;

    let baseQuery = db('disputes as d')
      .join('orders as o', 'o.id', 'd.order_id')
      .join('client_profiles as cp', 'cp.id', 'o.client_id')
      .join('worker_profiles as wp', 'wp.id', 'o.worker_id')
      .select(
        'd.id',
        'd.order_id',
        'd.opened_by_id',
        'd.reason',
        'd.evidence_url',
        'd.status',
        'd.resolution_notes',
        'd.created_at',
        'd.updated_at',
      );

    let countQuery = db('disputes as d')
      .join('orders as o', 'o.id', 'd.order_id')
      .join('client_profiles as cp', 'cp.id', 'o.client_id')
      .join('worker_profiles as wp', 'wp.id', 'o.worker_id');

    if (role !== 'admin') {
      const userFilter = function () {
        this.where('d.opened_by_id', userId)
          .orWhere('cp.user_id', userId)
          .orWhere('wp.user_id', userId);
      };
      baseQuery = baseQuery.where(userFilter);
      countQuery = countQuery.where(userFilter);
    }

    const [{ count }] = await countQuery.count('* as count');
    const total = Number(count);

    const rows = await baseQuery.orderBy('d.created_at', 'desc').limit(limit).offset(offset);

    return { disputes: rows, count: total, limit, offset };
  }

  async resolveDispute(disputeId, adminUserId, { status, resolutionNotes, winner }) {
    const dispute = await db('disputes').where({ id: disputeId }).first();
    if (!dispute) {
      return { error: 'DISPUTE_NOT_FOUND', message: 'Disputa no encontrada' };
    }

    if (dispute.status !== 'OPEN') {
      return { error: 'DISPUTE_NOT_OPEN', message: 'La disputa no está en estado OPEN' };
    }

    const order = await db('orders').where({ id: dispute.order_id }).first();
    if (!order) {
      return { error: 'ORDER_NOT_FOUND', message: 'Orden asociada no encontrada' };
    }

    const [clientProfile, workerProfile] = await Promise.all([
      db('client_profiles').where({ id: order.client_id }).first(),
      db('worker_profiles').where({ id: order.worker_id }).first(),
    ]);

    const transaction = await db('transactions').where({ order_id: order.id }).first();

    try {
      await db.transaction(async (trx) => {
        // Actualizar la disputa
        await trx('disputes').where({ id: disputeId }).update({
          status,
          resolution_notes: resolutionNotes,
          updated_at: trx.fn.now(),
        });

        if (status === 'RESOLVED') {
          if (winner === 'client') {
            // Reembolso al cliente
            if (transaction) {
              if (transaction.status === 'ESCROWED') {
                // Simular reembolso a la tarjeta del cliente
                const refundResult = await escrowService.refundCard({
                  paymentMethodId: transaction.payment_method_id,
                  amount: transaction.amount,
                });
                if (!refundResult.success) {
                  throw new Error('REFUND_FAILED');
                }

                // Debitar escrowed_balance de la wallet del cliente
                await escrowService.getOrCreateWallet(trx, transaction.payer_id);
                await trx('user_wallets')
                  .where({ user_id: transaction.payer_id })
                  .decrement('escrowed_balance', Number(transaction.amount));

                await trx('transactions').where({ id: transaction.id }).update({
                  status: 'REFUNDED',
                  updated_at: trx.fn.now(),
                });

                await trx('transaction_logs').insert({
                  transaction_id: transaction.id,
                  from_status: 'ESCROWED',
                  to_status: 'REFUNDED',
                  changed_by_id: adminUserId,
                  reason: `Disputa resuelta a favor del cliente: ${resolutionNotes}`,
                });
              } else if (transaction.status === 'COMPLETED') {
                // Fondos ya liberados. Se debita de current_balance del trabajador
                const refundResult = await escrowService.refundCard({
                  paymentMethodId: transaction.payment_method_id,
                  amount: transaction.amount,
                });
                if (!refundResult.success) {
                  throw new Error('REFUND_FAILED');
                }

                await escrowService.getOrCreateWallet(trx, transaction.receiver_id);
                await trx('user_wallets')
                  .where({ user_id: transaction.receiver_id })
                  .decrement('current_balance', Number(transaction.amount));

                await trx('transactions').where({ id: transaction.id }).update({
                  status: 'REFUNDED',
                  updated_at: trx.fn.now(),
                });

                await trx('transaction_logs').insert({
                  transaction_id: transaction.id,
                  from_status: 'COMPLETED',
                  to_status: 'REFUNDED',
                  changed_by_id: adminUserId,
                  reason: `Disputa resuelta a favor del cliente (fondos revertidos): ${resolutionNotes}`,
                });
              }
            }
          } else if (winner === 'worker') {
            // Liberar fondos al trabajador si estaban en escrow
            if (transaction && transaction.status === 'ESCROWED') {
              await escrowService.getOrCreateWallet(trx, transaction.payer_id);
              await escrowService.getOrCreateWallet(trx, transaction.receiver_id);

              await trx('user_wallets')
                .where({ user_id: transaction.payer_id })
                .decrement('escrowed_balance', Number(transaction.amount));
              await trx('user_wallets')
                .where({ user_id: transaction.receiver_id })
                .increment('current_balance', Number(transaction.amount));

              await trx('transactions').where({ id: transaction.id }).update({
                status: 'COMPLETED',
                updated_at: trx.fn.now(),
              });

              await trx('transaction_logs').insert({
                transaction_id: transaction.id,
                from_status: 'ESCROWED',
                to_status: 'COMPLETED',
                changed_by_id: adminUserId,
                reason: `Disputa resuelta a favor del trabajador: ${resolutionNotes}`,
              });
            }
          }
        }
      });
    } catch (err) {
      if (err.message === 'REFUND_FAILED') {
        return {
          error: 'REFUND_FAILED',
          message: 'No se pudo reembolsar a la tarjeta del cliente',
        };
      }
      throw err;
    }

    const updatedDispute = await db('disputes').where({ id: disputeId }).first();

    logger.info('[AUDITORIA] Disputa resuelta', {
      dispute_id: disputeId,
      status,
      winner,
      resolved_by: adminUserId,
      timestamp: new Date().toISOString(),
    });

    const notifyUserIds = [clientProfile?.user_id, workerProfile?.user_id].filter(Boolean);
    websocketHub.sendToUsers(notifyUserIds, 'dispute:status_changed', {
      dispute_id: disputeId,
      status,
      resolution_notes: resolutionNotes,
    });

    return { dispute: updatedDispute };
  }
}

export default new DisputeService();
