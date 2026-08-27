import db from '../database/db.js';
import logger from '../utils/logger.js';
import imageService from './ImageService.js';
import websocketHub from '../utils/websocket.js';
import notificationService from './NotificationService.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

class MessageService {
  formatMessage(row) {
    return {
      id: row.id,
      chat_id: row.chat_id,
      sender_id: row.sender_id,
      content: row.content,
      message_type: row.message_type,
      attachment_url: row.attachment_url,
      created_at: row.created_at,
    };
  }

  async getActiveParticipant(chatId, userId) {
    return db('chat_participants')
      .where({ chat_id: chatId, user_id: userId })
      .whereNull('deleted_at')
      .first();
  }

  async getChatParticipantIds(chatId) {
    const rows = await db('chat_participants')
      .where({ chat_id: chatId })
      .whereNull('deleted_at')
      .select('user_id');
    return rows.map((row) => row.user_id);
  }

  async createMessage(chatId, userId, data, file) {
    const participant = await this.getActiveParticipant(chatId, userId);
    if (!participant) {
      return { error: 'CHAT_NOT_FOUND' };
    }

    let attachmentUrl = null;

    if (data.message_type === 'IMAGE') {
      if (!file || !file.buffer) {
        return { error: 'IMAGE_REQUIRED' };
      }

      const stored = await imageService.compressAndStoreImage(file.buffer);
      if (stored.error) {
        return { error: stored.error };
      }
      attachmentUrl = stored.url;
    }

    let row;
    try {
      row = await db.transaction(async (trx) => {
        const [inserted] = await trx('messages')
          .insert({
            chat_id: chatId,
            sender_id: userId,
            content: data.content || null,
            message_type: data.message_type,
            attachment_url: attachmentUrl,
          })
          .returning([
            'id',
            'chat_id',
            'sender_id',
            'content',
            'message_type',
            'attachment_url',
            'created_at',
          ]);

        await trx('chats').where({ id: chatId }).update({ last_message_at: trx.fn.now() });
        return inserted;
      });
    } catch (err) {
      // Si la transacción falló, revierte el archivo ya escrito en disco
      if (attachmentUrl) {
        await imageService.deleteStoredFile(attachmentUrl).catch(() => {});
      }
      throw err;
    }

    const message = this.formatMessage(row);

    const otherIds = (await this.getChatParticipantIds(chatId)).filter((id) => id !== userId);
    websocketHub.sendToUsers(otherIds, 'message:new', { chat_id: chatId, message });

    // Notificar push/email/SMS a los demás participantes
    const senderProfile = await db('client_profiles').where({ user_id: userId }).first();
    const senderName = senderProfile?.full_name || 'Alguien';
    for (const recipientId of otherIds) {
      notificationService
        .send(recipientId, 'NEW_MESSAGE', {
          chat_id: chatId,
          sender_id: userId,
          sender_name: senderName,
          preview: data.content?.slice(0, 50) || 'Imagen',
        })
        .catch((err) =>
          logger.error('[NOTIFICATION] Error enviando notificación de mensaje', {
            error: err.message,
          }),
        );
    }

    logger.info('[AUDITORIA] Mensaje enviado', {
      chat_id: chatId,
      message_id: message.id,
      sender_id: userId,
      message_type: message.message_type,
      timestamp: new Date().toISOString(),
    });

    return { message };
  }

  async listMessages(chatId, userId, { limit = DEFAULT_LIMIT, offset = 0 } = {}) {
    const participant = await this.getActiveParticipant(chatId, userId);
    if (!participant) {
      return { error: 'CHAT_NOT_FOUND' };
    }

    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);

    const rows = await db('messages')
      .where({ chat_id: chatId })
      .whereNull('deleted_at')
      .select(
        'id',
        'chat_id',
        'sender_id',
        'content',
        'message_type',
        'attachment_url',
        'created_at',
      )
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(safeLimit)
      .offset(offset);

    const messages = rows.reverse().map((row) => this.formatMessage(row));

    // Marcar la conversación como leída al cargarla
    await db('chat_participants')
      .where({ chat_id: chatId, user_id: userId })
      .update({ last_read_at: db.fn.now() });

    return { messages, count: messages.length, limit: safeLimit, offset };
  }

  async deleteMessage(messageId, userId) {
    const message = await db('messages').where({ id: messageId }).first();
    if (!message || message.deleted_at) {
      return { error: 'MESSAGE_NOT_FOUND' };
    }

    if (message.sender_id !== userId) {
      return { error: 'FORBIDDEN' };
    }

    await db('messages').where({ id: messageId }).update({ deleted_at: db.fn.now() });

    const otherIds = (await this.getChatParticipantIds(message.chat_id)).filter(
      (id) => id !== userId,
    );
    websocketHub.sendToUsers(otherIds, 'message:deleted', {
      chat_id: message.chat_id,
      message_id: messageId,
    });

    logger.info('[AUDITORIA] Mensaje eliminado', {
      chat_id: message.chat_id,
      message_id: messageId,
      user_id: userId,
      timestamp: new Date().toISOString(),
    });

    return { deleted: true };
  }
}

export default new MessageService();
