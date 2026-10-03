import { Router } from 'express';
import uploadController from '../controllers/UploadController.js';
import { uploadProfileImage, handleUploadError } from '../middlewares/upload.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @openapi
 * /api/v1/uploads/profile-image:
 *   post:
 *     summary: Sube una imagen de identidad del perfil
 *     description: >-
 *       Recibe una imagen JPG/PNG (multipart, campo `file`), la recomprime a JPEG
 *       y devuelve la URL pública a persistir en `avatar_url`, `dni_front_url` o
 *       `dni_back_url` al crear o actualizar el perfil. La app móvil debe subir
 *       primero la selfie y las dos fotos del DNI, y luego enviar las URLs
 *       obtenidas en el alta del perfil.
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Imagen JPG/PNG de hasta 10MB.
 *     responses:
 *       201:
 *         description: Imagen almacenada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Imagen subida correctamente
 *                 url:
 *                   type: string
 *                   example: /uploads/profiles/6f1c9a2e-0d1b-4c7a-9f3e-2b8d5a4c1e77.jpg
 *       400:
 *         description: Archivo ausente, tipo no permitido o imagen corrupta
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token ausente o inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/profile-image',
  authenticateToken,
  uploadProfileImage.single('file'),
  handleUploadError,
  uploadController.uploadProfileImage,
);

export default router;
