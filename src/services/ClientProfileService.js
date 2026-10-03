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

const toApiProfile = (profile) => ({
  id: profile.id,
  user_id: profile.user_id,
  full_name: profile.full_name,
  date_of_birth: toDateOnly(profile.date_of_birth),
  avatar_url: profile.avatar_url,
  dni_front_url: profile.dni_front_url,
  dni_back_url: profile.dni_back_url,
  bio: profile.bio,
  default_location_id: profile.default_location_id,
  preferences: profile.preferences,
  created_at: profile.created_at,
  updated_at: profile.updated_at,
});

const PROFILE_COLUMNS = [
  'id',
  'user_id',
  'full_name',
  'date_of_birth',
  'avatar_url',
  'dni_front_url',
  'dni_back_url',
  'bio',
  'default_location_id',
  'preferences',
  'created_at',
  'updated_at',
];

class ClientProfileService {
  async getProfile(userId) {
    const profile = await db('client_profiles').where({ user_id: userId }).first();

    if (!profile) return null;

    return toApiProfile(profile);
  }

  async createProfile(userId, data) {
    const existing = await db('client_profiles').where({ user_id: userId }).first();
    if (existing) return null;

    const [profile] = await db('client_profiles')
      .insert({
        user_id: userId,
        full_name: data.full_name,
        date_of_birth: toDateString(data.date_of_birth),
        avatar_url: data.avatar_url,
        dni_front_url: data.dni_front_url,
        dni_back_url: data.dni_back_url,
        bio: data.bio || null,
        default_location_id: data.default_location_id || null,
        preferences: data.preferences || null,
      })
      .returning(PROFILE_COLUMNS);

    logger.info('[AUDITORIA] Perfil de cliente creado', {
      user_id: userId,
      profile_id: profile.id,
      timestamp: new Date().toISOString(),
    });

    return toApiProfile(profile);
  }

  async updateProfile(userId, data) {
    const existing = await db('client_profiles').where({ user_id: userId }).first();
    if (!existing) return null;

    const updates = {};
    if (data.full_name !== undefined) updates.full_name = data.full_name;
    if (data.date_of_birth !== undefined) updates.date_of_birth = toDateString(data.date_of_birth);
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url || null;
    if (data.dni_front_url !== undefined) updates.dni_front_url = data.dni_front_url || null;
    if (data.dni_back_url !== undefined) updates.dni_back_url = data.dni_back_url || null;
    if (data.bio !== undefined) updates.bio = data.bio || null;
    if (data.default_location_id !== undefined)
      updates.default_location_id = data.default_location_id || null;
    if (data.preferences !== undefined) updates.preferences = data.preferences || null;
    updates.updated_at = db.fn.now();

    await db('client_profiles').where({ user_id: userId }).update(updates);

    const profile = await db('client_profiles').where({ user_id: userId }).first();

    logger.info('[AUDITORIA] Perfil de cliente actualizado', {
      user_id: userId,
      profile_id: profile.id,
      changes: Object.keys(updates).filter((k) => k !== 'updated_at'),
      timestamp: new Date().toISOString(),
    });

    return toApiProfile(profile);
  }
}

export default new ClientProfileService();
