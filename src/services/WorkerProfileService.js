import db from '../database/db.js';
import logger from '../utils/logger.js';

/**
 * Joi convierte 'YYYY-MM-DD' a un Date en medianoche UTC y pg serializa un Date
 * a una columna DATE tomando la fecha local, con lo que en una zona horaria
 * detrás de UTC (Argentina, UTC-3) se guardaría un día menos. Se escribe el
 * texto que Joi interpretó, para que la fecha guardada sea la que envió el
 * cliente.
 */
const toDateString = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

/** Al leer, pg devuelve las columnas DATE como Date en medianoche local. */
const toDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
};

/**
 * hourly_rate admite NULL desde que la tarifa pasó a definirse en un flujo
 * posterior al alta del perfil. Number(null) devolvería 0 y publicaría un
 * trabajador como si prestara servicio gratis.
 */
const toRate = (value) => (value == null ? null : Number(value));

class WorkerProfileService {
  async getProfile(userId, { publicView = false } = {}) {
    const profile = await db('worker_profiles as wp')
      .where({ 'wp.user_id': userId })
      .leftJoin('categories as c', 'wp.category_id', 'c.id')
      .leftJoin('users as u', 'u.id', 'wp.user_id')
      .leftJoin('locations as loc', function () {
        this.on('loc.user_id', '=', 'wp.user_id').andOnVal('loc.is_primary', '=', db.raw('true'));
      })
      .select(
        'wp.id',
        'wp.user_id',
        'wp.full_name',
        'wp.date_of_birth',
        'wp.avatar_url',
        'wp.dni_front_url',
        'wp.dni_back_url',
        'wp.bio',
        'wp.category_id',
        'c.name as category_name',
        'wp.hourly_rate',
        'wp.availability_status',
        'wp.certification_status',
        'wp.average_rating',
        'wp.created_at',
        'wp.updated_at',
        'u.active as user_active',
        'loc.latitude',
        'loc.longitude',
        'loc.coverage_radius_km',
      )
      .first();

    if (!profile) return null;
    if (publicView && !profile.user_active) return null;

    const avgResult = await db('ratings')
      .where({ ratee_id: userId })
      .avg('rating_stars as average')
      .count('id as total_reviews')
      .first();
    const average = avgResult?.average ? Number(Number(avgResult.average).toFixed(1)) : (profile.average_rating != null ? Number(Number(profile.average_rating).toFixed(1)) : null);
    const totalReviews = Number(avgResult?.total_reviews || 0);

    const availability = await db('worker_availability')
      .where({ worker_id: profile.id })
      .orderBy([{ column: 'day_of_week' }, { column: 'start_time' }])
      .select('id', 'day_of_week', 'start_time', 'end_time');

    let portfolio = [];
    const hasPortfolio = await db.schema.hasTable('worker_portfolio_items');
    if (hasPortfolio) {
      portfolio = await db('worker_portfolio_items')
        .where({ worker_id: profile.id })
        .orderBy('created_at', 'desc')
        .select('id', 'image_url', 'title', 'description', 'created_at');
    }

    const base = {
      id: profile.id,
      user_id: profile.user_id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      category_id: profile.category_id,
      category_name: profile.category_name,
      hourly_rate: toRate(profile.hourly_rate),
      availability_status: profile.availability_status,
      certification_status: profile.certification_status,
      average_rating: average,
      total_reviews: totalReviews,
      availability: availability.map((a) => ({
        id: a.id,
        day_of_week: Number(a.day_of_week),
        start_time: typeof a.start_time === 'string' && a.start_time.length > 5 ? a.start_time.slice(0, 5) : a.start_time,
        end_time: typeof a.end_time === 'string' && a.end_time.length > 5 ? a.end_time.slice(0, 5) : a.end_time,
      })),
      portfolio,
      location: profile.latitude != null ? {
        latitude: Number(profile.latitude),
        longitude: Number(profile.longitude),
        coverage_radius_km: profile.coverage_radius_km != null ? Number(profile.coverage_radius_km) : null,
      } : null,
    };

    if (publicView) {
      return base;
    }

    return {
      ...base,
      date_of_birth: toDateOnly(profile.date_of_birth),
      dni_front_url: profile.dni_front_url,
      dni_back_url: profile.dni_back_url,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  async createProfile(userId, data) {
    const existing = await db('worker_profiles').where({ user_id: userId }).first();
    if (existing) return null;

    const [profile] = await db('worker_profiles')
      .insert({
        user_id: userId,
        full_name: data.full_name || '',
        date_of_birth: toDateString(data.date_of_birth),
        avatar_url: data.avatar_url,
        dni_front_url: data.dni_front_url,
        dni_back_url: data.dni_back_url,
        bio: data.bio || null,
        category_id: data.category_id || null,
        hourly_rate: data.hourly_rate ?? null,
        availability_status: data.availability_status || 'AVAILABLE',
      })
      .returning([
        'id',
        'user_id',
        'full_name',
        'date_of_birth',
        'avatar_url',
        'dni_front_url',
        'dni_back_url',
        'bio',
        'category_id',
        'hourly_rate',
        'availability_status',
        'certification_status',
        'created_at',
        'updated_at',
      ]);

    logger.info('[AUDITORIA] Perfil de trabajador creado', {
      user_id: userId,
      profile_id: profile.id,
      timestamp: new Date().toISOString(),
    });

    return {
      ...profile,
      date_of_birth: toDateOnly(profile.date_of_birth),
      hourly_rate: toRate(profile.hourly_rate),
    };
  }

  async updateProfile(userId, data) {
    const existing = await db('worker_profiles').where({ user_id: userId }).first();
    if (!existing) return null;

    const updates = {};
    if (data.category_id !== undefined) updates.category_id = data.category_id || null;
    if (data.hourly_rate !== undefined) updates.hourly_rate = data.hourly_rate ?? null;
    if (data.bio !== undefined) updates.bio = data.bio || null;
    if (data.availability_status !== undefined)
      updates.availability_status = data.availability_status;
    if (data.full_name !== undefined) updates.full_name = data.full_name;
    if (data.date_of_birth !== undefined) updates.date_of_birth = toDateString(data.date_of_birth);
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url || null;
    if (data.dni_front_url !== undefined) updates.dni_front_url = data.dni_front_url || null;
    if (data.dni_back_url !== undefined) updates.dni_back_url = data.dni_back_url || null;
    updates.updated_at = db.fn.now();

    await db('worker_profiles').where({ user_id: userId }).update(updates);

    const profile = await db('worker_profiles').where({ user_id: userId }).first();

    logger.info('[AUDITORIA] Perfil de trabajador actualizado', {
      user_id: userId,
      profile_id: profile.id,
      changes: Object.keys(updates).filter((k) => k !== 'updated_at'),
      timestamp: new Date().toISOString(),
    });

    return {
      id: profile.id,
      user_id: profile.user_id,
      full_name: profile.full_name,
      date_of_birth: toDateOnly(profile.date_of_birth),
      avatar_url: profile.avatar_url,
      dni_front_url: profile.dni_front_url,
      dni_back_url: profile.dni_back_url,
      bio: profile.bio,
      category_id: profile.category_id,
      hourly_rate: toRate(profile.hourly_rate),
      availability_status: profile.availability_status,
      certification_status: profile.certification_status,
      updated_at: profile.updated_at,
    };
  }
}

export default new WorkerProfileService();
