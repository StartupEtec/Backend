import db from '../database/db.js';
import logger from '../utils/logger.js';

class UserService {
  static toDateOnly(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    return [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  }

  static toDateString(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
  }

  static isIdentityComplete(identity) {
    return Boolean(
      identity &&
      identity.full_name &&
      identity.date_of_birth &&
      identity.avatar_url &&
      identity.dni_front_url &&
      identity.dni_back_url,
    );
  }

  async getIdentity(userId) {
    const user = await db('users')
      .where({ id: userId })
      .select('id', 'full_name', 'date_of_birth', 'avatar_url', 'dni_front_url', 'dni_back_url')
      .first();

    if (!user) return null;
    const identity = {
      id: user.id,
      full_name: user.full_name || null,
      date_of_birth: UserService.toDateOnly(user.date_of_birth),
      avatar_url: user.avatar_url || null,
      dni_front_url: user.dni_front_url || null,
      dni_back_url: user.dni_back_url || null,
    };
    return { ...identity, is_complete: UserService.isIdentityComplete(identity) };
  }

  async upsertIdentity(userId, data) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) return null;

    const updates = {};
    if (data.full_name !== undefined) updates.full_name = data.full_name;
    if (data.date_of_birth !== undefined)
      updates.date_of_birth = UserService.toDateString(data.date_of_birth);
    if (data.avatar_url !== undefined) updates.avatar_url = data.avatar_url || null;
    if (data.dni_front_url !== undefined) updates.dni_front_url = data.dni_front_url || null;
    if (data.dni_back_url !== undefined) updates.dni_back_url = data.dni_back_url || null;
    updates.updated_at = db.fn.now();

    await db('users').where({ id: userId }).update(updates);

    const identity = await this.getIdentity(userId);

    if (identity?.is_complete) {
      for (const tableName of ['client_profiles', 'worker_profiles']) {
        const existing = await db(tableName).where({ user_id: userId }).first();
        if (existing) {
          await db(tableName)
            .where({ user_id: userId })
            .update({
              full_name: identity.full_name,
              date_of_birth: UserService.toDateString(identity.date_of_birth),
              avatar_url: identity.avatar_url,
              dni_front_url: identity.dni_front_url,
              dni_back_url: identity.dni_back_url,
              updated_at: db.fn.now(),
            });
        } else {
          await db(tableName).insert({
            user_id: userId,
            full_name: identity.full_name,
            date_of_birth: UserService.toDateString(identity.date_of_birth),
            avatar_url: identity.avatar_url,
            dni_front_url: identity.dni_front_url,
            dni_back_url: identity.dni_back_url,
          });
        }
      }
      logger.info('[AUDITORIA] Identidad de usuario completada', {
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
    }

    return identity;
  }

  async getPublicProfile(userId) {
    const user = await db('users')
      .where({ id: userId, active: true })
      .select('id', 'email', 'full_name', 'avatar_url')
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
      full_name: user.full_name || profile?.full_name || null,
      avatar_url: user.avatar_url || profile?.avatar_url || null,
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
      identity: UserService.isIdentityComplete({
        full_name: user.full_name,
        date_of_birth: UserService.toDateOnly(user.date_of_birth),
        avatar_url: user.avatar_url,
        dni_front_url: user.dni_front_url,
        dni_back_url: user.dni_back_url,
      })
        ? {
            full_name: user.full_name,
            date_of_birth: UserService.toDateOnly(user.date_of_birth),
            avatar_url: user.avatar_url,
            dni_front_url: user.dni_front_url,
            dni_back_url: user.dni_back_url,
          }
        : null,
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

  async switchRole(userId, newRole) {
    const user = await db('users').where({ id: userId }).first();
    if (!user) return { error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' };

    if (user.current_role === newRole) {
      return {
        error: 'SAME_ROLE',
        message: `El usuario ya tiene el rol ${newRole}`,
      };
    }

    let clientProfile = await db('client_profiles').where({ user_id: userId }).first();
    let workerProfile = await db('worker_profiles').where({ user_id: userId }).first();

    // Auto-reparación para cuentas viejas: si la identidad está completa, se crea
    // la fila de rol faltante en vez de exigir completar de nuevo (sin SELECT
    // extra: se reutiliza la fila `user` ya leída).
    if (
      (!clientProfile || !workerProfile) &&
      UserService.isIdentityComplete({
        full_name: user.full_name,
        date_of_birth: UserService.toDateOnly(user.date_of_birth),
        avatar_url: user.avatar_url,
        dni_front_url: user.dni_front_url,
        dni_back_url: user.dni_back_url,
      })
    ) {
      const base = {
        full_name: user.full_name,
        date_of_birth: UserService.toDateString(user.date_of_birth),
        avatar_url: user.avatar_url,
        dni_front_url: user.dni_front_url,
        dni_back_url: user.dni_back_url,
      };
      if (!clientProfile) {
        await db('client_profiles').insert({ user_id: userId, ...base });
        clientProfile = await db('client_profiles').where({ user_id: userId }).first();
      }
      if (!workerProfile) {
        await db('worker_profiles').insert({ user_id: userId, ...base });
        workerProfile = await db('worker_profiles').where({ user_id: userId }).first();
      }
      logger.info('[AUDITORIA] Perfil de rol faltante auto-creado desde identidad', {
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
    }

    if (!clientProfile) {
      return {
        error: 'MISSING_CLIENT_PROFILE',
        message: 'Debes tener un perfil de cliente para cambiar de rol',
      };
    }
    if (!workerProfile) {
      return {
        error: 'MISSING_WORKER_PROFILE',
        message: 'Debes tener un perfil de trabajador para cambiar de rol',
      };
    }

    // "Por ahora": sin certificación aprobada se permite cambiar igual,
    // avisando con certification_pending (el front lo muestra en naranja).
    const certificationPending =
      newRole === 'worker' && workerProfile.certification_status !== 'APPROVED';

    const previousRole = user.current_role;

    await db('users').where({ id: userId }).update({
      current_role: newRole,
      last_role: previousRole,
    });

    const updatedUser = await db('users').where({ id: userId }).first();

    logger.info('[AUDITORIA] Cambio de rol', {
      user_id: userId,
      previous_role: previousRole,
      new_role: newRole,
      certification_pending: certificationPending,
      timestamp: new Date().toISOString(),
    });

    return { user: updatedUser, previousRole, certificationPending };
  }
}

export default new UserService();
