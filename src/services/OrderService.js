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
      description: row.description || null,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  formatOrderWithRelations(row) {
    const base = this.formatOrder(row);
    return {
      ...base,
      client: row.client_user_id
        ? {
            user_id: row.client_user_id,
            full_name: row.client_full_name,
            avatar_url: row.client_avatar_url,
          }
        : null,
      worker: row.worker_user_id
        ? {
            user_id: row.worker_user_id,
            full_name: row.worker_full_name,
            avatar_url: row.worker_avatar_url,
          }
        : null,
      quotes: row.quotes || [],
    };
  }

  async getOrderById(orderId, userId) {
    const order = await db('orders as o')
      .join('client_profiles as cp', 'cp.id', 'o.client_id')
      .join('users as cu', 'cu.id', 'cp.user_id')
      .join('worker_profiles as wp', 'wp.id', 'o.worker_id')
      .join('users as wu', 'wu.id', 'wp.user_id')
      .where('o.id', orderId)
      .first(
        'o.id',
        'o.client_id',
        'o.worker_id',
        'o.category_id',
        'o.location_id',
        'o.description',
        'o.status',
        'o.created_at',
        'o.updated_at',
        'cu.id as client_user_id',
        'cu.full_name as client_full_name',
        'cu.avatar_url as client_avatar_url',
        'wu.id as worker_user_id',
        'wu.full_name as worker_full_name',
        'wu.avatar_url as worker_avatar_url',
      );

    if (!order) return null;

    const { isClient, isWorker } = await this.getParticipation(
      order.client_id,
      order.worker_id,
      userId,
    );
    if (!isClient && !isWorker) return null;

    const quotes = await db('quotes').where({ order_id: orderId }).orderBy('created_at', 'asc');

    return this.formatOrderWithRelations({ ...order, quotes });
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

  async createOrder(userId, data) {
    // userId es el cliente que crea la orden
    const clientProfile = await db('client_profiles').where({ user_id: userId }).first();
    if (!clientProfile) {
      return {
        error: 'CLIENT_PROFILE_REQUIRED',
        message: 'Debes tener un perfil de cliente para crear órdenes',
      };
    }

    // Validar que worker_id pertenece a un perfil de trabajador válido
    const workerProfile = await db('worker_profiles').where({ id: data.worker_id }).first();
    if (!workerProfile) {
      return { error: 'WORKER_NOT_FOUND', message: 'Perfil de trabajador no encontrado' };
    }

    // Validar que category_id existe
    const category = await db('categories').where({ id: data.category_id, active: true }).first();
    if (!category) {
      return { error: 'CATEGORY_NOT_FOUND', message: 'Categoría no encontrada o inactiva' };
    }

    // Validar que location_id pertenece al cliente
    const location = await db('locations').where({ id: data.location_id, user_id: userId }).first();
    if (!location) {
      return {
        error: 'LOCATION_NOT_FOUND',
        message: 'Ubicación no encontrada o no pertenece al usuario',
      };
    }

    // Validar que client_id y worker_id no sean el mismo usuario
    if (clientProfile.user_id === workerProfile.user_id) {
      return {
        error: 'SAME_USER',
        message: 'El cliente y el trabajador no pueden ser el mismo usuario',
      };
    }

    const [row] = await db('orders')
      .insert({
        client_id: clientProfile.id,
        worker_id: data.worker_id,
        category_id: data.category_id,
        location_id: data.location_id,
        description: data.description || null,
        status: ORDER_STATUS.PENDING,
      })
      .returning([
        'id',
        'client_id',
        'worker_id',
        'category_id',
        'location_id',
        'description',
        'status',
        'created_at',
        'updated_at',
      ]);

    logger.info('[AUDITORIA] Orden creada', {
      order_id: row.id,
      client_user_id: userId,
      worker_user_id: workerProfile.user_id,
      timestamp: new Date().toISOString(),
    });

    return this.formatOrder(row);
  }

  async listUserOrders(userId, query) {
    const { limit, offset, status, role, date_from, date_to } = query;

    const [clientProfile, workerProfile] = await Promise.all([
      db('client_profiles').where({ user_id: userId }).first(),
      db('worker_profiles').where({ user_id: userId }).first(),
    ]);

    // Construir la query base
    let baseQuery = db('orders as o')
      .join('client_profiles as cp', 'cp.id', 'o.client_id')
      .join('users as cu', 'cu.id', 'cp.user_id')
      .join('worker_profiles as wp', 'wp.id', 'o.worker_id')
      .join('users as wu', 'wu.id', 'wp.user_id')
      .select(
        'o.id',
        'o.client_id',
        'o.worker_id',
        'o.category_id',
        'o.location_id',
        'o.description',
        'o.status',
        'o.created_at',
        'o.updated_at',
        'cu.id as client_user_id',
        'cu.full_name as client_full_name',
        'cu.avatar_url as client_avatar_url',
        'wu.id as worker_user_id',
        'wu.full_name as worker_full_name',
        'wu.avatar_url as worker_avatar_url',
      );

    // Filtrar por rol
    if (role === 'MINE_AS_CLIENT') {
      if (!clientProfile) {
        return { orders: [], count: 0, limit, offset };
      }
      baseQuery = baseQuery.where('o.client_id', clientProfile.id);
    } else if (role === 'MINE_AS_WORKER') {
      if (!workerProfile) {
        return { orders: [], count: 0, limit, offset };
      }
      baseQuery = baseQuery.where('o.worker_id', workerProfile.id);
    } else {
      // Por defecto: todas las órdenes donde el usuario participa (como cliente O trabajador)
      const conditions = [];
      if (clientProfile) conditions.push({ 'o.client_id': clientProfile.id });
      if (workerProfile) conditions.push({ 'o.worker_id': workerProfile.id });
      if (conditions.length === 0) {
        return { orders: [], count: 0, limit, offset };
      }
      baseQuery = baseQuery.where(function () {
        conditions.forEach((cond) => this.orWhere(cond));
      });
    }

    // Filtros adicionales
    if (status) {
      baseQuery = baseQuery.where('o.status', status);
    }
    if (date_from) {
      baseQuery = baseQuery.where('o.created_at', '>=', date_from);
    }
    if (date_to) {
      baseQuery = baseQuery.where('o.created_at', '<=', date_to);
    }

    // Obtener total count (sin límite/offset)
    const countQuery = db('orders as o')
      .join('client_profiles as cp', 'cp.id', 'o.client_id')
      .join('users as cu', 'cu.id', 'cp.user_id')
      .join('worker_profiles as wp', 'wp.id', 'o.worker_id')
      .join('users as wu', 'wu.id', 'wp.user_id');

    // Aplicar los mismos filtros para el count
    if (role === 'MINE_AS_CLIENT') {
      if (!clientProfile) return { orders: [], count: 0, limit, offset };
      countQuery.where('o.client_id', clientProfile.id);
    } else if (role === 'MINE_AS_WORKER') {
      if (!workerProfile) return { orders: [], count: 0, limit, offset };
      countQuery.where('o.worker_id', workerProfile.id);
    } else {
      const conditions = [];
      if (clientProfile) conditions.push({ 'o.client_id': clientProfile.id });
      if (workerProfile) conditions.push({ 'o.worker_id': workerProfile.id });
      if (conditions.length === 0) return { orders: [], count: 0, limit, offset };
      countQuery.where(function () {
        conditions.forEach((cond) => this.orWhere(cond));
      });
    }

    if (status) countQuery.where('o.status', status);
    if (date_from) countQuery.where('o.created_at', '>=', date_from);
    if (date_to) countQuery.where('o.created_at', '<=', date_to);

    const [{ count }] = await countQuery.count('* as count');
    const total = Number(count);

    // Ejecutar query paginada
    const rows = await baseQuery.orderBy('o.created_at', 'desc').limit(limit).offset(offset);

    // Para cada orden, obtener cotizaciones
    const orderIds = rows.map((r) => r.id);
    let quotesMap = {};
    if (orderIds.length > 0) {
      const quotesRows = await db('quotes')
        .whereIn('order_id', orderIds)
        .orderBy('created_at', 'asc');
      for (const q of quotesRows) {
        if (!quotesMap[q.order_id]) quotesMap[q.order_id] = [];
        quotesMap[q.order_id].push({
          id: q.id,
          order_id: q.order_id,
          proposed_price: Number(q.proposed_price),
          proposed_date: q.proposed_date,
          proposed_time: q.proposed_time,
          status: q.status,
          rejection_reason: q.rejection_reason,
          created_at: q.created_at,
          updated_at: q.updated_at,
        });
      }
    }

    const orders = rows.map((row) =>
      this.formatOrderWithRelations({
        ...row,
        quotes: quotesMap[row.id] || [],
      }),
    );

    return { orders, count: total, limit, offset };
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
