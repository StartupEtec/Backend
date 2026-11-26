import db from '../database/db.js';
import logger from '../utils/logger.js';
import { toPublicUrl } from '../utils/publicUrl.js';
import notificationService from './NotificationService.js';
import quoteService from './QuoteService.js';

const REQUEST_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

const ALLOWED_TRANSITIONS = {
  [REQUEST_STATUS.PENDING]: [
    REQUEST_STATUS.ACCEPTED,
    REQUEST_STATUS.REJECTED,
    REQUEST_STATUS.CANCELLED,
  ],
};

const ACTIVE_ORDER_STATUSES = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

class QuoteRequestService {
  formatDate(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatRequest(row) {
    return {
      id: row.id,
      client_id: row.client_id,
      worker_id: row.worker_id,
      category_id: row.category_id,
      location_id: row.location_id || null,
      description: row.description || null,
      budget: row.budget != null ? Number(row.budget) : null,
      scheduled_date: this.formatDate(row.scheduled_date),
      status: row.status,
      rejection_reason: row.rejection_reason || null,
      order_id: row.order_id || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      category_name: row.category_name || null,
      category: row.category_name || null,
      location_address: row.location_address || null,
      location: row.location_address || null,
      client: row.client_full_name
        ? {
            user_id: row.client_id,
            full_name: row.client_full_name,
            avatar_url: toPublicUrl(row.client_avatar_url),
          }
        : null,
      worker: row.worker_full_name
        ? {
            user_id: row.worker_id,
            full_name: row.worker_full_name,
            avatar_url: toPublicUrl(row.worker_avatar_url),
          }
        : null,
      quotes: row.quotes || [],
    };
  }

  baseQuery() {
    return db('quote_requests as qr')
      .leftJoin('users as cu', 'cu.id', 'qr.client_id')
      .leftJoin('users as wu', 'wu.id', 'qr.worker_id')
      .leftJoin('categories as cat', 'cat.id', 'qr.category_id')
      .leftJoin('locations as loc', 'loc.id', 'qr.location_id')
      .leftJoin('client_profiles as cp', 'cp.user_id', 'qr.client_id')
      .leftJoin('worker_profiles as wp', 'wp.user_id', 'qr.worker_id')
      .select(
        'qr.*',
        'cat.name as category_name',
        'loc.address as location_address',
        db.raw('COALESCE(cp.full_name, cu.full_name) as client_full_name'),
        'cu.avatar_url as client_avatar_url',
        db.raw('COALESCE(wp.full_name, wu.full_name) as worker_full_name'),
        'wu.avatar_url as worker_avatar_url',
      );
  }

  async fetchRequest(requestId) {
    return this.baseQuery().where('qr.id', requestId).first();
  }

  async create(userId, data) {
    const [clientProfile, workerProfile, category] = await Promise.all([
      db('client_profiles').where({ user_id: userId }).first(),
      db('worker_profiles').where({ user_id: data.worker_id }).first(),
      db('categories').where({ id: data.category_id, active: true }).first(),
    ]);

    if (!clientProfile) {
      return {
        error: 'CLIENT_PROFILE_REQUIRED',
        message: 'Debes tener un perfil de cliente para solicitar un servicio',
      };
    }
    if (!workerProfile) {
      return { error: 'WORKER_NOT_FOUND', message: 'Trabajador no encontrado' };
    }
    if (workerProfile.user_id === userId) {
      return { error: 'SAME_USER', message: 'No puedes solicitarte un servicio a ti mismo' };
    }
    if (!category) {
      return { error: 'CATEGORY_NOT_FOUND', message: 'Categoría no encontrada o inactiva' };
    }
    if (data.location_id) {
      const location = await db('locations')
        .where({ id: data.location_id, user_id: userId })
        .first();
      if (!location) {
        return {
          error: 'LOCATION_NOT_FOUND',
          message: 'Ubicación no encontrada o no pertenece al usuario',
        };
      }
    }

    const [row] = await db('quote_requests')
      .insert({
        client_id: userId,
        worker_id: data.worker_id,
        category_id: data.category_id,
        location_id: data.location_id || null,
        description: data.description || null,
        budget: data.budget ?? null,
        scheduled_date: data.scheduled_date
          ? new Date(data.scheduled_date).toISOString().slice(0, 10)
          : null,
        status: REQUEST_STATUS.PENDING,
      })
      .returning('*');

    logger.info('[AUDITORIA] Solicitud de cotización creada', {
      request_id: row.id,
      client_user_id: userId,
      worker_user_id: data.worker_id,
      timestamp: new Date().toISOString(),
    });

    notificationService
      .send(data.worker_id, 'SERVICE_REQUEST', {
        request_id: row.id,
        category_id: data.category_id,
        description: data.description || null,
      })
      .catch((err) =>
        logger.error('[NOTIFICATION] Error enviando notificación de solicitud', {
          error: err.message,
        }),
      );

    return this.formatRequest(row);
  }

  async list(userId, { limit = DEFAULT_LIMIT, offset = 0, status, role } = {}) {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

    const applyFilters = (query) => {
      if (role === 'MINE_AS_CLIENT') {
        query.where('qr.client_id', userId);
      } else if (role === 'MINE_AS_WORKER') {
        query.where('qr.worker_id', userId);
      } else {
        query.where(function () {
          this.where('qr.client_id', userId).orWhere('qr.worker_id', userId);
        });
      }
      if (status) query.where('qr.status', status);
      return query;
    };

    const countQuery = db('quote_requests as qr');
    applyFilters(countQuery);
    const [{ count }] = await countQuery.count('* as count');
    const total = Number(count);

    const rows = await applyFilters(this.baseQuery())
      .orderBy('qr.created_at', 'desc')
      .limit(safeLimit)
      .offset(offset);

    return {
      requests: rows.map((row) => this.formatRequest(row)),
      count: total,
      limit: safeLimit,
      offset,
    };
  }

  async getById(requestId, userId) {
    const row = await this.fetchRequest(requestId);
    if (!row) return null;
    if (row.client_id !== userId && row.worker_id !== userId) return null;

    let quotes = [];
    if (row.order_id) {
      const quoteRows = await db('quotes')
        .where({ order_id: row.order_id })
        .orderBy('created_at', 'asc');
      quotes = quoteRows.map((quote) => quoteService.formatQuote(quote));
    }

    return this.formatRequest({ ...row, quotes });
  }

  async createQuoteFromRequest(requestId, userId, data) {
    const request = await db('quote_requests').where({ id: requestId }).first();
    if (!request) {
      return { error: 'REQUEST_NOT_FOUND' };
    }

    const workerProfile = await db('worker_profiles').where({ user_id: userId }).first();
    if (!workerProfile || workerProfile.user_id !== request.worker_id) {
      return { error: 'FORBIDDEN' };
    }
    if (request.status !== REQUEST_STATUS.PENDING) {
      return { error: 'REQUEST_NOT_PENDING' };
    }

    const clientProfile = await db('client_profiles').where({ user_id: request.client_id }).first();
    if (!clientProfile) {
      return { error: 'MISSING_REQUEST_PARTICIPANTS' };
    }

    if (request.order_id) {
      const order = await db('orders').where({ id: request.order_id }).first();
      if (order && !ACTIVE_ORDER_STATUSES.includes(order.status)) {
        return { error: 'ORDER_NOT_ACTIVE' };
      }
    }

    const proposedDate =
      data.proposed_date instanceof Date
        ? data.proposed_date.toISOString().slice(0, 10)
        : data.proposed_date;

    const { quote, orderId } = await db.transaction(async (trx) => {
      let currentOrderId = request.order_id;
      if (!currentOrderId) {
        const [order] = await trx('orders')
          .insert({
            client_id: clientProfile.id,
            worker_id: workerProfile.id,
            category_id: request.category_id,
            location_id: request.location_id || null,
            description: request.description || null,
            suggested_budget: request.budget ?? null,
            scheduled_date: request.scheduled_date || null,
            status: 'PENDING',
          })
          .returning('id');
        currentOrderId = order.id;
      }

      const [newQuote] = await trx('quotes')
        .insert({
          order_id: currentOrderId,
          proposed_price: data.proposed_price,
          proposed_date: proposedDate,
          proposed_time: data.proposed_time,
          status: 'PENDING',
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

      await trx('quote_requests')
        .where({ id: requestId })
        .update({ order_id: currentOrderId, updated_at: trx.fn.now() });

      return { quote: newQuote, orderId: currentOrderId };
    });

    logger.info('[AUDITORIA] Cotización creada desde solicitud', {
      request_id: requestId,
      quote_id: quote.id,
      order_id: orderId,
      worker_user_id: userId,
      timestamp: new Date().toISOString(),
    });

    notificationService
      .send(request.client_id, 'QUOTE_RECEIVED', {
        request_id: requestId,
        order_id: orderId,
        quote_id: quote.id,
        price: data.proposed_price,
      })
      .catch((err) =>
        logger.error('[NOTIFICATION] Error enviando notificación de cotización', {
          error: err.message,
        }),
      );

    return { ...quoteService.formatQuote(quote), order_id: orderId };
  }

  async updateStatus(requestId, userId, data) {
    const request = await db('quote_requests').where({ id: requestId }).first();
    if (!request) {
      return { error: 'REQUEST_NOT_FOUND' };
    }
    if (request.client_id !== userId && request.worker_id !== userId) {
      return { error: 'FORBIDDEN' };
    }

    const allowed = ALLOWED_TRANSITIONS[request.status];
    if (!allowed || !allowed.includes(data.status)) {
      return {
        error: 'INVALID_TRANSITION',
        message: `No se puede pasar de ${request.status} a ${data.status}`,
      };
    }

    await db('quote_requests')
      .where({ id: requestId })
      .update({
        status: data.status,
        rejection_reason: data.rejection_reason || null,
        updated_at: db.fn.now(),
      });

    logger.info('[AUDITORIA] Estado de solicitud actualizado', {
      request_id: requestId,
      actor_user_id: userId,
      from: request.status,
      to: data.status,
      timestamp: new Date().toISOString(),
    });

    return this.formatRequest(await this.fetchRequest(requestId));
  }

  async remove(requestId, userId) {
    const request = await db('quote_requests').where({ id: requestId }).first();
    if (!request) {
      return { error: 'REQUEST_NOT_FOUND' };
    }
    if (request.client_id !== userId) {
      return { error: 'FORBIDDEN' };
    }
    if (request.status !== REQUEST_STATUS.PENDING) {
      return { error: 'REQUEST_NOT_PENDING' };
    }

    const deleted = await db('quote_requests').where({ id: requestId }).del();

    logger.info('[AUDITORIA] Solicitud de cotización eliminada', {
      request_id: requestId,
      client_user_id: userId,
      timestamp: new Date().toISOString(),
    });

    return deleted > 0;
  }
}

export default new QuoteRequestService();
