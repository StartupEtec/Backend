import db from '../database/db.js';
import logger from './logger.js';

export const isAutoApproveEnabled = () => process.env.AUTO_APPROVE_WORKERS === 'true';

export const initialCertificationStatus = () => (isAutoApproveEnabled() ? 'APPROVED' : 'PENDING');

export async function autoApproveWorkerByUserId(userId, query = db) {
  if (!isAutoApproveEnabled() || !userId) return false;

  const profile = await query('worker_profiles').where({ user_id: userId }).first('id');
  if (!profile) return false;

  const [updated] = await query('worker_profiles')
    .where({ id: profile.id })
    .update({ certification_status: 'APPROVED', updated_at: query.fn.now() })
    .returning('id');

  if (updated) {
    logger.info('[AUDITORIA] Autoaprobación de trabajador aplicada', {
      user_id: userId,
      profile_id: profile.id,
      timestamp: new Date().toISOString(),
    });
  }

  return Boolean(updated);
}

export async function autoApproveWorkerByProfileId(workerId, query = db) {
  if (!isAutoApproveEnabled() || !workerId) return false;

  const [updated] = await query('worker_profiles')
    .where({ id: workerId })
    .update({ certification_status: 'APPROVED', updated_at: query.fn.now() })
    .returning('id');

  if (updated) {
    logger.info('[AUDITORIA] Autoaprobación de trabajador aplicada', {
      profile_id: workerId,
      timestamp: new Date().toISOString(),
    });
  }

  return Boolean(updated);
}
