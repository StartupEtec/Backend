import db from '../database/db.js';
import logger from '../utils/logger.js';

class UserService {
  async getPublicProfile(userId) {
    const user = await db('users')
      .where({ id: userId, active: true })
      .select('id', 'email')
      .first();

    if (!user) return null;

    const clientProfile = await db('client_profiles')
      .where({ user_id: userId })
      .select('full_name', 'avatar_url', 'bio')
      .first();

    const workerProfile = await db('worker_profiles')
      .where({ user_id: userId })
      .select('full_name', 'avatar_url', 'bio')
      .first();

    const profile = clientProfile || workerProfile;

    const avgRating = await db('ratings')
      .where({ ratee_id: userId })
      .avg('rating_stars as average')
      .first();

    return {
      id: user.id,
      full_name: profile?.full_name || null,
      avatar_url: profile?.avatar_url || null,
      bio: profile?.bio || null,
      average_rating: avgRating?.average ? Number(avgRating.average).toFixed(1) : null,
      role: workerProfile ? 'worker' : 'client',
    };
  }

  async getPrivateProfile(userId) {
    const user = await db('users').where({ id: userId }).first();

    if (!user) return null;

    const clientProfile = await db('client_profiles').where({ user_id: userId }).first();

    const workerProfile = await db('worker_profiles').where({ user_id: userId }).first();

    const avgRating = await db('ratings')
      .where({ ratee_id: userId })
      .avg('rating_stars as average')
      .first();

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      current_role: user.current_role,
      is_verified: user.is_verified,
      verified_email: user.verified_email,
      verified_phone: user.verified_phone,
      active: user.active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      average_rating: avgRating?.average ? Number(avgRating.average).toFixed(1) : null,
      profile: {
        client: clientProfile
          ? {
              id: clientProfile.id,
              full_name: clientProfile.full_name,
              avatar_url: clientProfile.avatar_url,
              bio: clientProfile.bio,
            }
          : null,
        worker: workerProfile
          ? {
              id: workerProfile.id,
              full_name: workerProfile.full_name,
              avatar_url: workerProfile.avatar_url,
              bio: workerProfile.bio,
              hourly_rate: workerProfile.hourly_rate,
              availability_status: workerProfile.availability_status,
              certification_status: workerProfile.certification_status,
            }
          : null,
      },
    };
  }

  async updateProfile(userId, data, currentRole) {
    const tableName = currentRole === 'worker' ? 'worker_profiles' : 'client_profiles';

    const existingProfile = await db(tableName).where({ user_id: userId }).first();

    if (existingProfile) {
      await db(tableName)
        .where({ user_id: userId })
        .update({
          full_name: data.full_name,
          avatar_url: data.avatar_url || null,
          bio: data.bio || null,
          updated_at: db.fn.now(),
        });
    } else {
      await db(tableName).insert({
        user_id: userId,
        full_name: data.full_name,
        avatar_url: data.avatar_url || null,
        bio: data.bio || null,
      });
    }

    const updated = await db(tableName).where({ user_id: userId }).first();

    logger.info('[AUDITORIA] Perfil de usuario actualizado', {
      user_id: userId,
      role: currentRole,
      profile_id: updated.id,
      changes: {
        full_name: data.full_name,
        avatar_url: data.avatar_url,
        bio_length: data.bio?.length || 0,
      },
      timestamp: new Date().toISOString(),
    });

    return {
      id: updated.id,
      full_name: updated.full_name,
      avatar_url: updated.avatar_url,
      bio: updated.bio,
      updated_at: updated.updated_at,
    };
  }
}

export default new UserService();
