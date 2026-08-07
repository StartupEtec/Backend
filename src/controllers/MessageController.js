import messageService from '../services/MessageService.js';
import logger from '../utils/logger.js';
import { createMessageSchema, listMessagesQuerySchema } from '../utils/validation.js';

const UPLOAD_ERROR_MESSAGES = {
  IMAGE_REQUIRED: 'Para un mensaje IMAGE debes adjuntar un archivo de imagen (JPG/PNG)',
  INVALID_IMAGE: 'El archivo adjunto no es una imagen válida',
  INVALID_IMAGE_TYPE: 'El archivo adjunto debe ser una imagen JPG o PNG',
};

const errorResponse = (res, error, message, statusCode) =>
  res.status(statusCode).json({ error, message, statusCode, timestamp: new Date().toISOString() });

class MessageController {
  async create(req, res, next) {
    try {
      const { error, value } = createMessageSchema.validate(req.body || {});
      if (error) {
        return errorResponse(res, 'VALIDATION_ERROR', error.details[0].message, 400);
      }

      const result = await messageService.createMessage(
        req.params.chat_id,
        req.user.user_id,
        value,
        req.file,
      );

      if (result.error === 'CHAT_NOT_FOUND') {
        return errorResponse(
          res,
          'CHAT_NOT_FOUND',
          'Chat no encontrado o no tienes acceso a él',
          404,
        );
      }

      if (result.error === 'IMAGE_REQUIRED') {
        return errorResponse(res, 'IMAGE_REQUIRED', UPLOAD_ERROR_MESSAGES.IMAGE_REQUIRED, 400);
      }

      if (result.error === 'INVALID_IMAGE' || result.error === 'INVALID_IMAGE_TYPE') {
        return errorResponse(res, result.error, UPLOAD_ERROR_MESSAGES[result.error], 400);
      }

      return res.status(201).json(result);
    } catch (err) {
      if (err.name === 'MulterError' || err.code === 'INVALID_FILE_TYPE') {
        const message =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'La imagen no debe superar los 5MB'
            : err.message || 'Error al procesar el archivo adjunto';
        return errorResponse(res, 'UPLOAD_ERROR', message, 400);
      }
      logger.error('Error al crear mensaje:', err);
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { error, value } = listMessagesQuerySchema.validate(req.query);
      if (error) {
        return errorResponse(res, 'VALIDATION_ERROR', error.details[0].message, 400);
      }

      const result = await messageService.listMessages(req.params.chat_id, req.user.user_id, value);

      if (result.error === 'CHAT_NOT_FOUND') {
        return errorResponse(
          res,
          'CHAT_NOT_FOUND',
          'Chat no encontrado o no tienes acceso a él',
          404,
        );
      }

      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al listar mensajes:', err);
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const result = await messageService.deleteMessage(req.params.message_id, req.user.user_id);

      if (result.error === 'MESSAGE_NOT_FOUND') {
        return errorResponse(res, 'MESSAGE_NOT_FOUND', 'Mensaje no encontrado', 404);
      }

      if (result.error === 'FORBIDDEN') {
        return errorResponse(res, 'FORBIDDEN', 'Solo el autor puede eliminar el mensaje', 403);
      }

      return res.status(200).json({ message: 'Mensaje eliminado correctamente' });
    } catch (err) {
      logger.error('Error al eliminar mensaje:', err);
      next(err);
    }
  }
}

export default new MessageController();
