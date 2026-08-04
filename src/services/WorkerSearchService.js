import db from '../database/db.js';
import cache from '../utils/cache.js';
import logger from '../utils/logger.js';

const CACHE_TTL_SECONDS = 300;

class WorkerSearchService {
  formatRow(row) {
    return {
      worker_id: row.worker_id,
      user_id: row.user_id,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      category_id: row.category_id,
      category_name: row.category_name,
      hourly_rate: Number(row.hourly_rate),
      availability_status: row.availability_status,
      certification_status: row.certification_status,
      average_rating: row.average_rating != null ? Number(row.average_rating).toFixed(1) : null,
      distance_km: Math.round((Number(row.distance_m) / 1000) * 100) / 100,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
    };
  }

  async findNearby({ latitude, longitude, radius_km, category_id, limit, offset }) {
    const cacheKey = `nearby:${latitude},${longitude},${radius_km},${category_id || ''},${limit},${offset}`;

    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info('[CACHE] HIT para búsqueda de trabajadores', { cacheKey });
      return cached;
    }

    const radiusMeters = radius_km * 1000;

    const query = db('worker_profiles as wp')
      .join('users as u', 'u.id', 'wp.user_id')
      .join('locations as loc', 'loc.user_id', 'wp.user_id')
      .leftJoin('categories as c', 'c.id', 'wp.category_id')
      .where('wp.availability_status', 'AVAILABLE')
      .where('wp.certification_status', 'APPROVED')
      .where('u.active', true)
      .where('loc.is_primary', true)
      .whereRaw('ST_DWithin(loc.geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)', [
        longitude,
        latitude,
        radiusMeters,
      ])
      .select(
        'wp.id as worker_id',
        'wp.user_id',
        'wp.full_name',
        'wp.avatar_url',
        'wp.category_id',
        'c.name as category_name',
        'wp.hourly_rate',
        'wp.availability_status',
        'wp.certification_status',
        'loc.latitude',
        'loc.longitude',
        db.raw(
          'ST_DistanceSphere(loc.geography::geometry, ST_MakePoint(?, ?)::geometry) as distance_m',
          [longitude, latitude],
        ),
        db.raw(
          '(SELECT AVG(r.rating_stars) FROM ratings r WHERE r.ratee_id = wp.user_id) as average_rating',
        ),
      );

    if (category_id) {
      query.where('wp.category_id', category_id);
    }

    const rows = await query.orderBy('distance_m', 'asc').limit(limit).offset(offset);

    const workers = rows.map((row) => this.formatRow(row));
    const result = {
      workers,
      count: workers.length,
      limit,
      offset,
    };

    await cache.set(cacheKey, result, CACHE_TTL_SECONDS);

    return result;
  }
}

export default new WorkerSearchService();
