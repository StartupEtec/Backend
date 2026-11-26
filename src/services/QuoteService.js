import db from '../database/db.js';
import logger from '../utils/logger.js';
import escrowService from './EscrowService.js';
import notificationService from './NotificationService.js';

// Estados de la máquina de estados de cotizaciones.
const QUOTE_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

// Transiciones permitidas: solo se puede transicionar desde PENDING.
const ALLOWED_TRANSITIONS = {
  [QUOTE_STATUS.PENDING]: [QUOTE_STATUS.ACCEPTED, QUOTE_STATUS.REJECTED, QUOTE_STATUS.CANCELLED],
};

const ACTIVE_ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'];

class QuoteService {
  /**
   * Convierte una fila de `quotes` a la representación de la API.
   * `proposed_price` llega como cadena desde pg y `proposed_date` como Date.
   */
  formatQuote(row) {
    return {
      id: row.id,
      order_id: row.order_id,
      proposed_price: Number(row.proposed_price),
      proposed_date: this.formatDate(row.proposed_date),
      proposed_time: row.proposed_time != null ? String(row.proposed_time) : null,
      status: row.status,
      rejection_reason: row.rejection_reason || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  // Formatea la fecha con componentes locales para evitar corrimientos por zona horaria (UTC).
  formatDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Devuelve la cotización junto con los datos de la orden (client_id, worker_id, status).
  async fetchQuoteWithOrder(quoteId) {
    return db('quotes as q')
      .join('orders as o', 'o.id', 'q.order_id')
      .where('q.id', quoteId)
      .first(
        'q.id',
        'q.order_id',
        'q.proposed_price',
        'q.proposed_date',
        'q.proposed_time',
        'q.status',
        'q.rejection_reason',
        'q.created_at',
        'q.updated_at',
        'o.client_id as order_client_id',
        'o.worker_id as order_worker_id',
        'o.status as order_status',
      );
  }

  // Indica si el usuario participa en la orden como cliente o como trabajador.
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

  async createQuote(userId, orderId, data) {
    const [workerProfile, order] = await Promise.all([
      db('worker_profiles').where({ user_id: userId }).first(),
      db('orders').where({ id: orderId }).first(),
    ]);

    if (!order) {
      return { error: 'ORDER_NOT_FOUND' };
    }

    // Solo el trabajador asignado a la orden puede cotizar.
    if (!workerProfile || order.worker_id !== workerProfile.id) {
      return { error: 'FORBIDDEN' };
    }

    if (!ACTIVE_ORDER_STATUSES.includes(order.status)) {
      return { error: 'ORDER_NOT_ACTIVE' };
    }

    const proposedDate =
      data.proposed_date instanceof Date
        ? data.proposed_date.toISOString().slice(0, 10)
        : data.proposed_date;

    const [row] = await db('quotes')
      .insert({
        order_id: orderId,
        proposed_price: data.proposed_price,
        proposed_date: proposedDate,
        proposed_time: data.proposed_time,
        status: QUOTE_STATUS.PENDING,
      })
      .returning([
        'id',
        'order_id',
        'proposed_price',
        'proposed_date',
        'proposed_time',
        'status',
        'rejection_reason',
        'created_at',
        'updated_at',
      ]);

    logger.info('[AUDITORIA] Cotización creada', {
      quote_id: row.id,
      order_id: orderId,
      worker_user_id: userId,
      timestamp: new Date().toISOString(),
    });

    // Notificar al cliente que recibió una cotización
    const clientProfile = await db('client_profiles').where({ id: order.client_id }).first();
    if (clientProfile?.user_id) {
      notificationService
        .send(clientProfile.user_id, 'QUOTE_RECEIVED', {
          order_id: orderId,
          quote_id: row.id,
          price: data.proposed_price,
        })
        .catch((err) =>
          logger.error('[NOTIFICATION] Error enviando notificación de cotización', {
            error: err.message,
          }),
        );
    }

    return this.formatQuote(row);
  }

  async listQuotesByOrder(orderId, userId) {
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

    const rows = await db('quotes').where({ order_id: orderId }).orderBy('created_at', 'asc');
    return rows.map((row) => this.formatQuote(row));
  }

  async getQuoteById(quoteId, userId) {
    const quote = await this.fetchQuoteWithOrder(quoteId);
    if (!quote) {
      return null;
    }

    const { isClient, isWorker } = await this.getParticipation(
      quote.order_client_id,
      quote.order_worker_id,
      userId,
    );
    if (!isClient && !isWorker) {
      return null;
    }

    return this.formatQuote(quote);
  }

  async updateQuoteStatus(quoteId, userId, data) {
    const quote = await this.fetchQuoteWithOrder(quoteId);
    if (!quote) {
      return { error: 'QUOTE_NOT_FOUND' };
    }

    const { isClient, isWorker } = await this.getParticipation(
      quote.order_client_id,
      quote.order_worker_id,
      userId,
    );

    // Solo el cliente puede aceptar o rechazar; solo el trabajador puede cancelar su propuesta.
    if (data.status === QUOTE_STATUS.CANCELLED) {
      if (!isWorker) {
        return { error: 'FORBIDDEN' };
      }
    } else if (!isClient) {
      return { error: 'FORBIDDEN' };
    }

    const allowedNextStates = ALLOWED_TRANSITIONS[quote.status];
    if (!allowedNextStates || !allowedNextStates.includes(data.status)) {
      return {
        error: 'INVALID_TRANSITION',
        message: `No se puede pasar de ${quote.status} a ${data.status}`,
      };
    }

    if (data.status === QUOTE_STATUS.ACCEPTED) {
      try {
        return await this.acceptQuote(quote);
      } catch (err) {
        // Violación de unicidad al iniciar el pago (una transacción por orden).
        if (err.code === '23505') {
          return { error: 'PAYMENT_ALREADY_STARTED' };
        }
        throw err;
      }
    }

    await db('quotes')
      .where({ id: quoteId })
      .update({
        status: data.status,
        rejection_reason: data.rejection_reason || null,
        updated_at: db.fn.now(),
      });

    logger.info('[AUDITORIA] Cotización actualizada', {
      quote_id: quoteId,
      order_id: quote.order_id,
      from: quote.status,
      to: data.status,
      actor_user_id: userId,
      timestamp: new Date().toISOString(),
    });

    const updated = await this.fetchQuoteWithOrder(quoteId);
    return this.formatQuote(updated);
  }

  /**
   * Aceptación de una cotización: transacción atómica que
   * 1) marca la cotización como ACCEPTED,
   * 2) rechaza las demás cotizaciones pendientes de la orden,
   * 3) pasa la orden a ACCEPTED,
   * 4) inicia el escrow cargando la tarjeta del cliente (ESCROWED) o, si el
   *    cargo falla, deja la transacción en FAILED y cancela la orden.
   */
  async acceptQuote(quote) {
    const [clientProfile, workerProfile] = await Promise.all([
      db('client_profiles').where({ id: quote.order_client_id }).first(),
      db('worker_profiles').where({ id: quote.order_worker_id }).first(),
    ]);

    if (!clientProfile || !workerProfile) {
      return { error: 'MISSING_ORDER_PARTICIPANTS' };
    }

    const primaryPaymentMethod = await db('payment_methods')
      .where({ user_id: clientProfile.user_id, is_primary: true })
      .first();

    const escrowResult = await db.transaction(async (trx) => {
      await trx('quotes').where({ id: quote.id }).update({
        status: QUOTE_STATUS.ACCEPTED,
        rejection_reason: null,
        updated_at: trx.fn.now(),
      });

      await trx('quotes')
        .where({ order_id: quote.order_id, status: QUOTE_STATUS.PENDING })
        .whereNot({ id: quote.id })
        .update({
          status: QUOTE_STATUS.REJECTED,
          rejection_reason: 'Rechazada automáticamente por la aceptación de otra cotización',
          updated_at: trx.fn.now(),
        });

      await trx('orders').where({ id: quote.order_id }).update({
        status: 'ACCEPTED',
        updated_at: trx.fn.now(),
      });

      return escrowService.startEscrow(trx, {
        orderId: quote.order_id,
        payerId: clientProfile.user_id,
        receiverId: workerProfile.user_id,
        amount: quote.proposed_price,
        paymentMethodId: primaryPaymentMethod ? primaryPaymentMethod.id : null,
        actorUserId: clientProfile.user_id,
      });
    });

    if (!escrowResult.success) {
      logger.warn('[AUDITORIA] Cotización aceptada pero el pago falló; orden cancelada', {
        quote_id: quote.id,
        order_id: quote.order_id,
        reason: escrowResult.reason,
        timestamp: new Date().toISOString(),
      });

      return {
        error: 'PAYMENT_FAILED',
        message: 'No se pudo cargar el pago a la tarjeta del cliente; la orden fue cancelada',
      };
    }

    logger.info('[AUDITORIA] Cotización aceptada y escrow iniciado', {
      quote_id: quote.id,
      order_id: quote.order_id,
      amount: quote.proposed_price,
      timestamp: new Date().toISOString(),
    });

    // Notificar al trabajador que su cotización fue aceptada
    if (workerProfile?.user_id) {
      notificationService
        .send(workerProfile.user_id, 'QUOTE_ACCEPTED', {
          order_id: quote.order_id,
          quote_id: quote.id,
          price: quote.proposed_price,
        })
        .catch((err) =>
          logger.error('[NOTIFICATION] Error enviando notificación de aceptación', {
            error: err.message,
          }),
        );
    }

    const updated = await db('quotes').where({ id: quote.id }).first();
    return this.formatQuote(updated);
  }

  async deleteQuote(quoteId, userId) {
    const quote = await this.fetchQuoteWithOrder(quoteId);
    if (!quote) {
      return { error: 'QUOTE_NOT_FOUND' };
    }

    const { isWorker } = await this.getParticipation(
      quote.order_client_id,
      quote.order_worker_id,
      userId,
    );
    if (!isWorker) {
      return { error: 'FORBIDDEN' };
    }

    // Solo se puede eliminar una cotización aún pendiente.
    if (quote.status !== QUOTE_STATUS.PENDING) {
      return { error: 'QUOTE_NOT_PENDING' };
    }

    const deleted = await db('quotes').where({ id: quoteId }).del();

    logger.info('[AUDITORIA] Cotización eliminada', {
      quote_id: quoteId,
      order_id: quote.order_id,
      worker_user_id: userId,
      timestamp: new Date().toISOString(),
    });

    return deleted > 0;
  }
}

export default new QuoteService();
