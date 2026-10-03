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
  async getProfile(userId) {
    const profile = await db('worker_profiles')
      .where({ user_id: userId })
      .leftJoin('categories', 'worker_profiles.category_id', 'categories.id')
      .select(
        'worker_profiles.id',
        'worker_profiles.user_id',
        'worker_profiles.full_name',
        'worker_profiles.date_of_birth',
        'worker_profiles.avatar_url',
        'worker_profiles.dni_front_url',
        'worker_profiles.dni_back_url',
        'worker_profiles.bio',
        'worker_profiles.category_id',
        'categories.name as category_name',
        'worker_profiles.hourly_rate',
        'worker_profiles.availability_status',
        'worker_profiles.certification_status',
        'worker_profiles.created_at',
        'worker_profiles.updated_at',
      )
      .first();

    if (!profile) return null;

    const avgRating = await db('ratings')
      .where({ ratee_id: userId })
      .avg('rating_stars as average')
      .first();

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
      category_name: profile.category_name,
      hourly_rate: toRate(profile.hourly_rate),
      availability_status: profile.availability_status,
      certification_status: profile.certification_status,
      average_rating: avgRating?.average ? Number(avgRating.average).toFixed(1) : null,
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
        full_name: data.full_name,
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
