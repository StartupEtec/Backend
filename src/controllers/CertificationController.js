import certificationService from '../services/CertificationService.js';
import db from '../database/db.js';
import logger from '../utils/logger.js';
import { createCertificationSchema, updateCertificationStatusSchema } from '../utils/validation.js';

const errorResponse = (res, statusCode, error, message) =>
  res.status(statusCode).json({
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  });

class CertificationController {
  async create(req, res, next) {
    try {
      const { id } = req.params; // worker_id

      const worker = await db('worker_profiles').where({ id }).first();
      if (!worker) {
        return errorResponse(
          res,
          404,
          'WORKER_PROFILE_NOT_FOUND',
          'Perfil de trabajador no encontrado',
        );
      }

      if (worker.user_id !== req.user.user_id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No autorizado para subir certificaciones a este perfil',
        );
      }

      const { error, value } = createCertificationSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      if (!req.file) {
        return errorResponse(
          res,
          400,
          'VALIDATION_ERROR',
          'Debe adjuntar un archivo de certificación',
        );
      }

      const result = await certificationService.createCertification(
        id,
        value.document_type,
        req.file,
      );
      if (result.error) {
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', result.message);
      }

      return res.status(201).json({
        message: 'Certificación agregada correctamente',
        certification: result.certification,
      });
    } catch (err) {
      logger.error('Error al crear certificación:', err);
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { id } = req.params; // worker_id

      const worker = await db('worker_profiles').where({ id }).first();
      if (!worker) {
        return errorResponse(
          res,
          404,
          'WORKER_PROFILE_NOT_FOUND',
          'Perfil de trabajador no encontrado',
        );
      }

      if (worker.user_id !== req.user.user_id) {
        return errorResponse(res, 403, 'FORBIDDEN', 'No autorizado para ver estas certificaciones');
      }

      const result = await certificationService.listCertifications(id);
      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al listar certificaciones:', err);
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params; // certification_id

      const result = await certificationService.getCertificationDetails(id);
      if (result.error) {
        return errorResponse(res, 404, 'CERTIFICATION_NOT_FOUND', result.message);
      }

      const worker = await db('worker_profiles')
        .where({ id: result.certification.worker_id })
        .first();
      if (!worker) {
        return errorResponse(
          res,
          404,
          'WORKER_PROFILE_NOT_FOUND',
          'Perfil de trabajador asociado no encontrado',
        );
      }

      // Allow access to the owner of the certification
      if (worker.user_id !== req.user.user_id) {
        return errorResponse(res, 403, 'FORBIDDEN', 'No autorizado para ver esta certificación');
      }

      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al obtener certificación:', err);
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params; // certification_id

      const cert = await db('certifications').where({ id }).first();
      if (!cert) {
        return errorResponse(res, 404, 'CERTIFICATION_NOT_FOUND', 'Certificación no encontrada');
      }

      const worker = await db('worker_profiles').where({ id: cert.worker_id }).first();
      if (!worker) {
        return errorResponse(
          res,
          404,
          'WORKER_PROFILE_NOT_FOUND',
          'Perfil de trabajador no encontrado',
        );
      }

      if (worker.user_id !== req.user.user_id) {
        return errorResponse(
          res,
          403,
          'FORBIDDEN',
          'No autorizado para actualizar esta certificación',
        );
      }

      if (!req.file) {
        return errorResponse(
          res,
          400,
          'VALIDATION_ERROR',
          'Debe adjuntar el nuevo archivo de certificación',
        );
      }

      const result = await certificationService.updateCertificationDocument(id, req.file);
      if (result.error) {
        if (result.error === 'INVALID_STATE') {
          return errorResponse(res, 400, 'INVALID_STATE', result.message);
        }
        return errorResponse(res, 500, 'INTERNAL_SERVER_ERROR', result.message);
      }

      return res.status(200).json({
        message: 'Certificación reenviada correctamente',
        certification: result.certification,
      });
    } catch (err) {
      logger.error('Error al actualizar certificación:', err);
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params; // certification_id

      const { error, value } = updateCertificationStatusSchema.validate(req.body);
      if (error) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', error.details[0].message);
      }

      const result = await certificationService.updateCertificationStatus(
        id,
        value.verification_status,
        value.rejected_reason,
        req.user.user_id,
      );

      if (result.error) {
        return errorResponse(res, 404, 'CERTIFICATION_NOT_FOUND', result.message);
      }

      return res.status(200).json({
        message: 'Estado de certificación actualizado correctamente',
        certification: result.certification,
      });
    } catch (err) {
      logger.error('Error al actualizar estado de certificación:', err);
      next(err);
    }
  }
}

export default new CertificationController();
