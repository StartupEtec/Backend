import { Router } from 'express';
import certificationController from '../controllers/CertificationController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { uploadCertificationDocument, handleUploadError } from '../middlewares/upload.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Certificaciones
 *   description: Envío, validación y gestión de documentos de certificación de proveedores
 */

/**
 * @openapi
 * /workers/{id}/certifications:
 *   post:
 *     summary: Subir un documento de certificación
 *     description: Permite al proveedor subir un documento (PDF/imagen) de validación para su perfil (BACKGROUND_CHECK, ID_VERIFICATION o PROFESSIONAL_LICENSE). Máximo 10MB.
 *     tags: [Certificaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del perfil de proveedor
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [document, document_type]
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Archivo digitalizado (PDF, JPG, PNG) max 10MB
 *               document_type:
 *                 type: string
 *                 enum: [BACKGROUND_CHECK, ID_VERIFICATION, PROFESSIONAL_LICENSE]
 *                 example: ID_VERIFICATION
 *     responses:
 *       201:
 *         description: Documento subido y registrado correctamente en estado PENDING
 *       400:
 *         description: Error de validación o formato/tamaño de archivo no permitido
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Perfil de trabajador no encontrado
 *
 *   get:
 *     summary: Listar las certificaciones de un proveedor
 *     description: Devuelve todos los documentos de certificación subidos por el proveedor asociado.
 *     tags: [Certificaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del perfil de proveedor
 *     responses:
 *       200:
 *         description: Lista de certificaciones devuelta exitosamente
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Perfil de trabajador no encontrado
 */
router.post(
  '/workers/:id/certifications',
  authenticateToken,
  uploadCertificationDocument.single('document'),
  handleUploadError,
  certificationController.create,
);

router.get('/workers/:id/certifications', authenticateToken, certificationController.list);

/**
 * @openapi
 * /certifications/{id}:
 *   get:
 *     summary: Obtener el detalle de una certificación
 *     description: Retorna la información de una certificación específica. Acceso exclusivo al proveedor propietario y al administrador.
 *     tags: [Certificaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la certificación
 *     responses:
 *       200:
 *         description: Detalle de certificación devuelto exitosamente
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Certificación no encontrada
 *
 *   patch:
 *     summary: Reenviar un documento de certificación rechazado
 *     description: Permite subir un nuevo archivo para una certificación que fue previamente REJECTED, cambiando su estado a PENDING.
 *     tags: [Certificaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la certificación
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [document]
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *                 description: Nuevo archivo digitalizado
 *     responses:
 *       200:
 *         description: Documento reenviado y estado restablecido a PENDING
 *       400:
 *         description: Error de validación o la certificación no se encuentra rechazada
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Certificación no encontrada
 */
router.get('/certifications/:id', authenticateToken, certificationController.getById);

router.patch(
  '/certifications/:id',
  authenticateToken,
  uploadCertificationDocument.single('document'),
  handleUploadError,
  certificationController.update,
);

/**
 * @openapi
 * /certifications/{id}/status:
 *   patch:
 *     summary: Actualizar estado de verificación de una certificación (Admin)
 *     description: Permite aprobar (APPROVED) o rechazar (REJECTED) una certificación de proveedor. Requiere motivo de rechazo en caso de REJECTED.
 *     tags: [Certificaciones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la certificación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [verification_status]
 *             properties:
 *               verification_status:
 *                 type: string
 *                 enum: [PENDING, APPROVED, REJECTED]
 *                 example: APPROVED
 *               rejected_reason:
 *                 type: string
 *                 minLength: 5
 *                 example: "Documento de identidad poco legible o borroso"
 *                 description: Requerido solo si status es REJECTED
 *     responses:
 *       200:
 *         description: Estado de certificación actualizado correctamente
 *       400:
 *         description: Error de validación (ej. falta motivo en rechazo)
 *       401:
 *         description: No autenticado
 *       403:
 *         description: No autorizado
 *       404:
 *         description: Certificación no encontrada
 */
router.patch('/certifications/:id/status', authenticateToken, certificationController.updateStatus);

export default router;
