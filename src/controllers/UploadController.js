import imageService from '../services/ImageService.js';
import logger from '../utils/logger.js';

class UploadController {
  /**
   * Sube una imagen de identidad del perfil y devuelve la URL pública a persistir
   * en avatar_url, dni_front_url o dni_back_url.
   *
   * La imagen se recomprime a JPEG con sharp, así que la URL devuelta siempre
   * termina en .jpg y cumple el patrón de validación de los perfiles.
   */
  async uploadProfileImage(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Debe adjuntar una imagen en el campo "file"',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await imageService.compressAndStoreImage(req.file.buffer, {
        folder: 'profiles',
      });

      if (result.error) {
        return res.status(400).json({
          error: result.error,
          message:
            result.error === 'INVALID_IMAGE'
              ? 'El archivo enviado no es una imagen válida'
              : 'Solo se permiten imágenes JPG o PNG',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      logger.info('[AUDITORIA] Imagen de perfil subida', {
        user_id: req.user.user_id,
        url: result.url,
        bytes: req.file.size,
        timestamp: new Date().toISOString(),
      });

      return res.status(201).json({
        message: 'Imagen subida correctamente',
        url: result.url,
      });
    } catch (err) {
      logger.error('Error al subir imagen de perfil:', err);
      next(err);
    }
  }
}

export default new UploadController();
