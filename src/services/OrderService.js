import db from '../database/db.js';
import logger from '../utils/logger.js';
import websocketHub from '../utils/websocket.js';
import escrowService from './EscrowService.js';

// Error de escrow lanzado dentro de una transacción para abortar la operación.
class EscrowOperationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EscrowOperationError';
    this.code = code;
  }
}

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.ACCEPTED, ORDER_STATUS.REJECTED],
  [ORDER_STATUS.ACCEPTED]: [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.IN_PROGRESS]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
};

class OrderService {
  formatOrder(row) {
    return {
      id: row.id,
      client_id: row.client_id,
      worker_id: row.worker_id,
      category_id: row.category_id,
      location_id: row.location_id,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async getOrderById(orderId, userId) {
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) return null;

    const { isClient, isWorker } = await this.getParticipation(
      order.client_id,
      order.worker_id,
      userId,
    );
    if (!isClient && !isWorker) return null;

    return this.formatOrder(order);
  }

  async getParticipation(orderClientId, orderWorkerId, userId) {
    const [clientProfile, workerProfile] = await Promise.all([
      db('client_profiles').where({ user_id: userId }).first(),
      db('worker_profiles').where({ user_id: userId }).first(),
    ]);

    return {
      isClient: Boolean(clientProfile && clientProfile.id === orderClientId),
      isWorker: Boolean(workerProfile && workerProfile.id === orderWorkerId),
    };
  }

  async updateOrderStatus(orderId, userId, nextStatus) {
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) {
      return { error: 'ORDER_NOT_FOUND' };
    }

    const [clientProfile, workerProfile] = await Promise.all([
      db('client_profiles').where({ id: order.client_id }).first(),
      db('worker_profiles').where({ id: order.worker_id }).first(),
    ]);

    if (!clientProfile || !workerProfile) {
      return { error: 'MISSING_ORDER_PARTICIPANTS' };
    }

    const isClient = clientProfile.user_id === userId;
    const isWorker = workerProfile.user_id === userId;

    if (!isClient && !isWorker) {
      return { error: 'FORBIDDEN' };
    }

    // Validar transición de estado
    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(nextStatus)) {
      return {
        error: 'INVALID_TRANSITION',
        message: `Transición no permitida de ${order.status} a ${nextStatus}`,
      };
    }

    // Validaciones por rol/actor en transiciones específicas
    if (nextStatus === ORDER_STATUS.ACCEPTED && !isClient) {
      return { error: 'FORBIDDEN', message: 'Solo el cliente puede aceptar la orden' };
    }
    if (nextStatus === ORDER_STATUS.REJECTED && !isClient) {
      return { error: 'FORBIDDEN', message: 'Solo el cliente puede rechazar la orden' };
    }
    if (nextStatus === ORDER_STATUS.IN_PROGRESS && !isWorker) {
      return { error: 'FORBIDDEN', message: 'Solo el trabajador puede iniciar la orden' };
    }
    if (nextStatus === ORDER_STATUS.COMPLETED && !isWorker) {
      return { error: 'FORBIDDEN', message: 'Solo el trabajador puede completar la orden' };
    }

    // Actualización transaccional de estado, auditoría y escrow
    try {
      await db.transaction(async (trx) => {
        await trx('orders').where({ id: orderId }).update({
          status: nextStatus,
          updated_at: trx.fn.now(),
        });

        await trx('order_events').insert({
          order_id: orderId,
          user_id: userId,
          from_state: order.status,
          to_state: nextStatus,
        });

        const escrowError = await this.handleEscrowTransition(trx, orderId, nextStatus, userId);
        if (escrowError) {
          throw new EscrowOperationError(escrowError.error, escrowError.message);
        }

        logger.info('[AUDITORIA] Estado de orden actualizado', {
          order_id: orderId,
          actor_user_id: userId,
          from_state: order.status,
          to_state: nextStatus,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (err) {
      if (err instanceof EscrowOperationError) {
        return { error: err.code, message: err.message };
      }
      throw err;
    }

    const updatedOrder = await db('orders').where({ id: orderId }).first();

    // Notificaciones en tiempo real vía WebSocket
    const participantUserIds = [clientProfile.user_id, workerProfile.user_id];
    websocketHub.sendToUsers(participantUserIds, 'order:status_changed', {
      order_id: orderId,
      status: nextStatus,
    });

    return { order: this.formatOrder(updatedOrder) };
  }

  async getOrderHistory(orderId, userId) {
    const order = await db('orders').where({ id: orderId }).first();
    if (!order) {
      return { error: 'ORDER_NOT_FOUND' };
    }

    const { isClient, isWorker } = await this.getParticipation(
      order.client_id,
      order.worker_id,
      userId,
    );
    if (!isClient && !isWorker) {
      return { error: 'FORBIDDEN' };
    }

    const events = await db('order_events')
      .where({ order_id: orderId })
      .orderBy('created_at', 'asc');

    return { events };
  }

  /**
   * Acciones de escrow disparadas por una transición de estado de la orden.
   * Devuelve un error (o null) para abortar la transacción en caso de fallo.
   */
  async handleEscrowTransition(trx, orderId, nextStatus, actorUserId) {
    if (nextStatus !== ORDER_STATUS.COMPLETED && nextStatus !== ORDER_STATUS.CANCELLED) {
      return null;
    }

    const transaction = await trx('transactions').where({ order_id: orderId }).first();
    if (!transaction) {
      // Sin transacción asociada: la orden nunca llegó a pagarse, no hay escrow.
      return null;
    }

    if (nextStatus === ORDER_STATUS.COMPLETED) {
      const result = await escrowService.releaseFunds(trx, {
        transactionId: transaction.id,
        actorUserId,
      });
      if (result.error) return result;
      return null;
    }

    const result = await escrowService.refund(trx, {
      transactionId: transaction.id,
      actorUserId,
      reason: 'Orden cancelada',
    });
    if (result.error) return result;
    return null;
  }
}

export default new OrderService();
