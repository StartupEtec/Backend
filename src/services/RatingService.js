import db from '../database/db.js';
import logger from '../utils/logger.js';

class RatingService {
  async createRating(userId, data) {
    const order = await db('orders').where({ id: data.order_id }).first();
    if (!order) {
      return { error: 'ORDER_NOT_FOUND', message: 'Orden no encontrada' };
    }

    if (order.status !== 'COMPLETED') {
      return {
        error: 'ORDER_NOT_COMPLETED',
        message: 'Solo se pueden calificar órdenes en estado COMPLETED',
      };
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
        message: 'Solo el cliente o el trabajador de la orden pueden calificar',
      };
    }

    const rateeUserId = isClient ? workerProfile.user_id : clientProfile.user_id;

    const existing = await db('ratings')
      .where({ order_id: data.order_id, rater_id: userId })
      .first();
    if (existing) {
      return {
        error: 'ALREADY_RATED',
        message: 'Ya existe una calificación para esta orden por parte de este usuario',
      };
    }

    const [rating] = await db('ratings')
      .insert({
        order_id: data.order_id,
        rater_id: userId,
        ratee_id: rateeUserId,
        rating_stars: data.rating_stars,
        review_text: data.review_text || null,
      })
      .returning([
        'id',
        'order_id',
        'rater_id',
        'ratee_id',
        'rating_stars',
        'review_text',
        'created_at',
      ]);

    logger.info('[AUDITORIA] Calificación creada', {
      rating_id: rating.id,
      order_id: data.order_id,
      rater_user_id: userId,
      ratee_user_id: rateeUserId,
      rating_stars: data.rating_stars,
      timestamp: new Date().toISOString(),
    });

    await this.recalculateAverageRating(rateeUserId);

    return this.formatRating(rating);
  }

  async listRatingsByUser(userId, query) {
    const { limit, offset } = query;

    const [{ count }] = await db('ratings').where({ ratee_id: userId }).count('* as count');
    const total = Number(count);

    const rows = await db('ratings as r')
      .join('users as u', 'u.id', 'r.rater_id')
      .where('r.ratee_id', userId)
      .select(
        'r.id',
        'r.order_id',
        'r.rater_id',
        'r.ratee_id',
        'r.rating_stars',
        'r.review_text',
        'r.created_at',
        'u.full_name as rater_full_name',
        'u.avatar_url as rater_avatar_url',
      )
      .orderBy('r.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    const ratings = rows.map((row) => ({
      id: row.id,
      order_id: row.order_id,
      rater_id: row.rater_id,
      ratee_id: row.ratee_id,
      rating_stars: row.rating_stars,
      review_text: row.review_text,
      created_at: row.created_at,
      rater: {
        user_id: row.rater_id,
        full_name: row.rater_full_name,
        avatar_url: row.rater_avatar_url,
      },
    }));

    return { ratings, count: total, limit, offset };
  }

  async getRatingAverage(userId) {
    const result = await db('ratings')
      .where({ ratee_id: userId })
      .avg('rating_stars as average')
      .count('id as total_ratings')
      .first();

    const average = result?.average ? Number(Number(result.average).toFixed(1)) : null;
    const totalRatings = Number(result?.total_ratings || 0);

    return { average_rating: average, total_ratings: totalRatings };
  }

  async recalculateAverageRating(userId) {
    const result = await db('ratings')
      .where({ ratee_id: userId })
      .avg('rating_stars as average')
      .first();

    const avg = result?.average ? Number(Number(result.average).toFixed(1)) : null;

    const [workerProfile, clientProfile] = await Promise.all([
      db('worker_profiles').where({ user_id: userId }).first(),
      db('client_profiles').where({ user_id: userId }).first(),
    ]);

    if (workerProfile) {
      await db('worker_profiles').where({ user_id: userId }).update({
        average_rating: avg,
        updated_at: db.fn.now(),
      });
    }

    if (clientProfile) {
      await db('client_profiles').where({ user_id: userId }).update({
        average_rating: avg,
        updated_at: db.fn.now(),
      });
    }
  }

  formatRating(row) {
    return {
      id: row.id,
      order_id: row.order_id,
      rater_id: row.rater_id,
      ratee_id: row.ratee_id,
      rating_stars: row.rating_stars,
      review_text: row.review_text,
      created_at: row.created_at,
    };
  }
}

export default new RatingService();
