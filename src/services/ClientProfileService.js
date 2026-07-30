import db from '../database/db.js';
import logger from '../utils/logger.js';

class ClientProfileService {
  async getProfile(userId) {
    const profile = await db('client_profiles').where({ user_id: userId }).first();

    if (!profile) return null;

    return {
      id: profile.id,
      user_id: profile.user_id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      default_location_id: profile.default_location_id,
      preferences: profile.preferences,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  }

  async createProfile(userId, data) {
    const existing = await db('client_profiles').where({ user_id: userId }).first();
    if (existing) return null;

    const [profile] = await db('client_profiles')
      .insert({
        user_id: userId,
        full_name: data.full_name,
        avatar_url: data.avatar_url || null,
        bio: data.bio || null,
        default_location_id: data.default_location_id || null,
        preferences: data.preferences || null,
      })
      .returning([
        'id',
        'user_id',
        'full_name',
        'avatar_url',
        'bio',
        'default_location_id',
        'preferences',
        'created_at',
        'updated_at',
      ]);

    logger.info('[AUDITORIA] Perfil de cliente creado', {
      user_id: userId,
      profile_id: profile.id,
      timestamp: new Date().toISOString(),
    });

    return profile;
  }

  async updateProfile(userId, data) {
    const existing = await db('client_profiles').where({ user_id: userId }).first();
    if (!existing) return null;

    const updates = {};
    if (data.full_name !== undefined) updates.full_name = data.full_name;
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url || null;
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

    return {
      id: profile.id,
      user_id: profile.user_id,
      full_name: profile.full_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      default_location_id: profile.default_location_id,
      preferences: profile.preferences,
      updated_at: profile.updated_at,
    };
  }
}

export default new ClientProfileService();
