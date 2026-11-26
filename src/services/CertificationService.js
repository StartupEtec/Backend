import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import db from '../database/db.js';
import logger from '../utils/logger.js';
import cache from '../utils/cache.js';
import { initialCertificationStatus, isAutoApproveEnabled } from '../utils/autoApprove.js';

class CertificationService {
  async notifyWorker(workerId, status, details = {}) {
    try {
      const profile = await db('worker_profiles').where({ id: workerId }).first();
      if (!profile) return;
      const user = await db('users').where({ id: profile.user_id }).first();
      if (!user) return;

      logger.info(
        `[NOTIFICACIÓN] Enviada a ${user.email} (Trabajador: ${profile.full_name}): ` +
          `Tu certificación ha cambiado de estado a ${status}. ` +
          `Detalles: ${JSON.stringify(details)}`,
      );
    } catch (err) {
      logger.error('Error al enviar notificación simulada:', err);
    }
  }

  async createCertification(workerId, documentType, file) {
    const worker = await db('worker_profiles').where({ id: workerId }).first();
    if (!worker) {
      return {
        error: 'WORKER_PROFILE_NOT_FOUND',
        message: 'Perfil de trabajador no encontrado',
      };
    }

    const filename = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
    const absoluteDir = path.resolve('uploads/certifications');
    await fs.promises.mkdir(absoluteDir, { recursive: true });
    await fs.promises.writeFile(path.join(absoluteDir, filename), file.buffer);
    const documentUrl = `/uploads/certifications/${filename}`;

    const result = await db.transaction(async (trx) => {
      const [newCert] = await trx('certifications')
        .insert({
          worker_id: workerId,
          document_type: documentType,
          document_url: documentUrl,
          verification_status: initialCertificationStatus(),
          approved_at: isAutoApproveEnabled() ? trx.fn.now() : null,
        })
        .returning('*');

      if (isAutoApproveEnabled() || worker.certification_status !== 'APPROVED') {
        await trx('worker_profiles')
          .where({ id: workerId })
          .update({
            certification_status: isAutoApproveEnabled() ? 'APPROVED' : 'PENDING',
            updated_at: trx.fn.now(),
          });
      }

      logger.info('[AUDITORIA] Certificación subida', {
        worker_id: workerId,
        document_type: documentType,
        certification_id: newCert.id,
      });

      return newCert;
    });

    await cache.invalidateNearby();

    return { certification: result };
  }

  async listCertifications(workerId) {
    const worker = await db('worker_profiles').where({ id: workerId }).first();
    if (!worker) {
      return {
        error: 'WORKER_PROFILE_NOT_FOUND',
        message: 'Perfil de trabajador no encontrado',
      };
    }

    const list = await db('certifications')
      .where({ worker_id: workerId })
      .orderBy('created_at', 'desc');
    return { certifications: list };
  }

  async getCertificationDetails(id) {
    const cert = await db('certifications').where({ id }).first();
    if (!cert) {
      return {
        error: 'CERTIFICATION_NOT_FOUND',
        message: 'Certificación no encontrada',
      };
    }
    return { certification: cert };
  }

  async updateCertificationDocument(id, file) {
    const cert = await db('certifications').where({ id }).first();
    if (!cert) {
      return {
        error: 'CERTIFICATION_NOT_FOUND',
        message: 'Certificación no encontrada',
      };
    }

    if (cert.verification_status !== 'REJECTED') {
      return {
        error: 'INVALID_STATE',
        message: 'Solo se pueden actualizar certificaciones rechazadas',
      };
    }

    const filename = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
    const absoluteDir = path.resolve('uploads/certifications');
    await fs.promises.mkdir(absoluteDir, { recursive: true });
    await fs.promises.writeFile(path.join(absoluteDir, filename), file.buffer);
    const documentUrl = `/uploads/certifications/${filename}`;

    // Clean up old file asynchronously
    if (cert.document_url && cert.document_url.startsWith('/uploads/certifications/')) {
      const oldFilename = path.basename(cert.document_url);
      fs.promises.unlink(path.join(absoluteDir, oldFilename)).catch((err) => {
        logger.error('Error al eliminar archivo viejo de certificación:', err);
      });
    }

    const result = await db.transaction(async (trx) => {
      const [updated] = await trx('certifications')
        .where({ id })
        .update({
          document_url: documentUrl,
          verification_status: 'PENDING',
          rejected_reason: null,
          updated_at: trx.fn.now(),
        })
        .returning('*');

      await trx('worker_profiles')
        .where({ id: cert.worker_id })
        .update({ certification_status: 'PENDING', updated_at: trx.fn.now() });

      logger.info('[AUDITORIA] Certificación reenviada (nueva subida)', {
        certification_id: id,
        worker_id: cert.worker_id,
      });

      return updated;
    });

    return { certification: result };
  }

  async updateCertificationStatus(id, status, rejectedReason = null, actorUserId = null) {
    const cert = await db('certifications').where({ id }).first();
    if (!cert) {
      return {
        error: 'CERTIFICATION_NOT_FOUND',
        message: 'Certificación no encontrada',
      };
    }

    const resolvedStatus = isAutoApproveEnabled() ? 'APPROVED' : status;

    const result = await db.transaction(async (trx) => {
      const updateFields = {
        verification_status: resolvedStatus,
        updated_at: trx.fn.now(),
      };

      if (resolvedStatus === 'APPROVED') {
        updateFields.approved_at = trx.fn.now();
        updateFields.rejected_reason = null;
      } else if (resolvedStatus === 'REJECTED') {
        updateFields.approved_at = null;
        updateFields.rejected_reason = rejectedReason;
      }

      const [updated] = await trx('certifications')
        .where({ id })
        .update(updateFields)
        .returning('*');

      if (isAutoApproveEnabled()) {
        await trx('worker_profiles')
          .where({ id: cert.worker_id })
          .update({ certification_status: 'APPROVED', updated_at: trx.fn.now() });
      } else if (resolvedStatus === 'REJECTED') {
        await trx('worker_profiles')
          .where({ id: cert.worker_id })
          .update({ certification_status: 'REJECTED', updated_at: trx.fn.now() });
      } else if (resolvedStatus === 'APPROVED') {
        const allCerts = await trx('certifications').where({ worker_id: cert.worker_id });
        const allApproved =
          allCerts.length > 0 && allCerts.every((c) => c.verification_status === 'APPROVED');
        if (allApproved) {
          await trx('worker_profiles')
            .where({ id: cert.worker_id })
            .update({ certification_status: 'APPROVED', updated_at: trx.fn.now() });
        }
      }

      logger.info('[AUDITORIA] Cambio de estado de certificación', {
        certification_id: id,
        from_status: cert.verification_status,
        to_status: resolvedStatus,
        changed_by_id: actorUserId,
        rejected_reason: resolvedStatus === 'REJECTED' ? rejectedReason : undefined,
      });

      return updated;
    });

    await cache.invalidateNearby();

    this.notifyWorker(cert.worker_id, resolvedStatus, {
      certification_id: id,
      document_type: cert.document_type,
      rejected_reason: resolvedStatus === 'REJECTED' ? rejectedReason : undefined,
    });

    return { certification: result };
  }
}

export default new CertificationService();
