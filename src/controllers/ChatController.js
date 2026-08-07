import chatService from '../services/ChatService.js';
import logger from '../utils/logger.js';
import { createChatSchema, listChatsQuerySchema } from '../utils/validation.js';

class ChatController {
  async create(req, res, next) {
    try {
      const { error, value } = createChatSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await chatService.createChat(req.user.user_id, value);

      if (result.error === 'USER_NOT_FOUND') {
        return res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: 'Uno de los usuarios del chat no existe',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      if (result.error === 'SAME_USER') {
        return res.status(400).json({
          error: 'SAME_USER',
          message: 'No puedes crear un chat contigo mismo',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(result.created ? 201 : 200).json({
        chat_id: result.chat_id,
        created: result.created,
        message: result.created ? 'Chat creado correctamente' : 'El chat ya existe',
      });
    } catch (err) {
      logger.error('Error al crear chat:', err);
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { id } = req.params;

      if (req.user.user_id !== id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'No tienes permiso para ver los chats de otro usuario',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
      }

      const { error, value } = listChatsQuerySchema.validate(req.query);
      if (error) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: error.details[0].message,
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
      }

      const result = await chatService.listChats(id, value);

      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al listar chats:', err);
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { chat_id } = req.params;

      const result = await chatService.getChat(chat_id, req.user.user_id);

      if (result.error === 'CHAT_NOT_FOUND') {
        return res.status(404).json({
          error: 'CHAT_NOT_FOUND',
          message: 'Chat no encontrado o no tienes acceso a él',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json(result);
    } catch (err) {
      logger.error('Error al obtener chat:', err);
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const { chat_id } = req.params;

      const deleted = await chatService.deleteChat(chat_id, req.user.user_id);

      if (!deleted) {
        return res.status(404).json({
          error: 'CHAT_NOT_FOUND',
          message: 'Chat no encontrado o no tienes acceso a él',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(200).json({
        message: 'Chat eliminado correctamente',
      });
    } catch (err) {
      logger.error('Error al eliminar chat:', err);
      next(err);
    }
  }
}

export default new ChatController();
