import db from '../database/db.js';
import logger from '../utils/logger.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MESSAGES_LIMIT = 50;

class ChatService {
  /**
   * Ordena el par de usuarios de forma canónica (user_id_1 < user_id_2).
   * Esto, junto con el índice UNIQUE (user_id_1, user_id_2), garantiza un
   * único chat por pareja sin importar el orden en que se envíen los IDs.
   */
  canonicalPair(userIdA, userIdB) {
    return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
  }

  formatMessage(row) {
    return {
      id: row.id,
      sender_id: row.sender_id,
      content: row.content,
      message_type: row.message_type,
      attachment_url: row.attachment_url,
      created_at: row.created_at,
    };
  }

  formatChat(row) {
    return {
      chat_id: row.id,
      user_id_1: row.user_id_1,
      user_id_2: row.user_id_2,
      order_id: row.order_id,
      last_message_at: row.last_message_at,
      created_at: row.created_at,
    };
  }

  formatChatListItem(row) {
    return {
      chat_id: row.chat_id,
      order_id: row.order_id,
      last_message_at: row.last_message_at,
      is_favorite: Boolean(row.is_favorite),
      is_archived: Boolean(row.is_archived),
      last_message:
        row.last_message_content != null
          ? {
              content: row.last_message_content,
              sender_id: row.last_message_sender_id,
              created_at: row.last_message_created_at,
            }
          : null,
      other_user: {
        user_id: row.other_user_id,
        full_name: row.other_full_name,
        avatar_url: row.other_avatar_url,
      },
      unread_count: Number(row.unread_count),
    };
  }

  /**
   * Restaura la participación del usuario (upsert): si el usuario había
   * eliminado el chat (soft delete), lo reactiva; si no existe el registro,
   * lo crea.
   */
  async reactivateParticipant(chatId, userId) {
    await db('chat_participants')
      .insert({ chat_id: chatId, user_id: userId })
      .onConflict(['chat_id', 'user_id'])
      .merge({ deleted_at: null });
  }

  async createChat(userId, data) {
    const [user1, user2] = this.canonicalPair(userId, data.user_id_2);

    if (user1 === user2) {
      return { error: 'SAME_USER' };
    }

    const users = await db('users').whereIn('id', [user1, user2]).select('id');
    if (users.length !== 2) {
      return { error: 'USER_NOT_FOUND' };
    }

    const existing = await db('chats').where({ user_id_1: user1, user_id_2: user2 }).first();
    if (existing) {
      await this.reactivateParticipant(existing.id, userId);
      return { chat_id: existing.id, created: false };
    }

    try {
      const chat = await db.transaction(async (trx) => {
        const [row] = await trx('chats')
          .insert({ user_id_1: user1, user_id_2: user2, order_id: data.order_id || null })
          .returning(['id']);
        await trx('chat_participants').insert([
          { chat_id: row.id, user_id: user1 },
          { chat_id: row.id, user_id: user2 },
        ]);
        return row;
      });

      logger.info('[AUDITORIA] Chat creado', {
        chat_id: chat.id,
        user_id_1: user1,
        user_id_2: user2,
        timestamp: new Date().toISOString(),
      });

      return { chat_id: chat.id, created: true };
    } catch (err) {
      // Colisión de concurrencia sobre el índice UNIQUE: otro request creó el chat
      if (err.code === '23505') {
        const raced = await db('chats').where({ user_id_1: user1, user_id_2: user2 }).first();
        if (raced) {
          await this.reactivateParticipant(raced.id, userId);
          return { chat_id: raced.id, created: false };
        }
      }
      throw err;
    }
  }

  async listChats(userId, { limit = DEFAULT_LIMIT, offset = 0, status = 'all', search = '' } = {}) {
    const safeLimit = Math.min(Math.max(limit, 1), MAX_LIMIT);
    const activeOrderStatuses = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'];

    const query = db('chats as c')
      .join('chat_participants as me', 'me.chat_id', 'c.id')
      .join('chat_participants as p2', 'p2.chat_id', 'c.id')
      .leftJoin('worker_profiles as owp', 'owp.user_id', 'p2.user_id')
      .leftJoin('client_profiles as ocp', 'ocp.user_id', 'p2.user_id')
      .joinRaw(
        `LEFT JOIN LATERAL (
           SELECT content, sender_id, created_at
           FROM messages
           WHERE chat_id = c.id
             AND deleted_at IS NULL
           ORDER BY created_at DESC, id DESC
           LIMIT 1
         ) lm ON TRUE`,
      )
      .where('me.user_id', userId)
      .where('p2.user_id', '<>', userId)
      .whereNull('me.deleted_at')
      .select(
        'c.id as chat_id',
        'c.order_id',
        'c.last_message_at',
        'me.is_favorite',
        'me.is_archived',
        'p2.user_id as other_user_id',
        db.raw('COALESCE(owp.full_name, ocp.full_name) as other_full_name'),
        db.raw('COALESCE(owp.avatar_url, ocp.avatar_url) as other_avatar_url'),
        db.raw('lm.content as last_message_content'),
        db.raw('lm.sender_id as last_message_sender_id'),
        db.raw('lm.created_at as last_message_created_at'),
        db.raw(
          `(SELECT COUNT(*) FROM messages m
            WHERE m.chat_id = c.id
              AND m.sender_id != ?
              AND m.deleted_at IS NULL
              AND (me.last_read_at IS NULL OR m.created_at > me.last_read_at)) as unread_count`,
          [userId],
        ),
      );

    if (status === 'favorites') {
      query.where('me.is_favorite', true);
    } else if (status === 'active') {
      // Chats con una orden vinculada en curso (no finalizada)
      query.whereExists(function activeOrder() {
        this.select('o')
          .from('orders as o')
          .whereRaw('o.id = c.order_id')
          .whereIn('o.status', activeOrderStatuses);
      });
    }
    if (status !== 'archived') {
      // El archivo es un estado excluyente: solo se muestra con status=archived
      query.where('me.is_archived', false);
    } else {
      query.where('me.is_archived', true);
    }
    if (search) {
      query.andWhereRaw('COALESCE(owp.full_name, ocp.full_name) ILIKE ?', [`%${search}%`]);
    }

    const rows = await query
      .orderBy('me.is_favorite', 'desc')
      .orderBy('c.last_message_at', 'desc')
      .limit(safeLimit)
      .offset(offset);

    const chats = rows.map((row) => this.formatChatListItem(row));

    return {
      chats,
      count: chats.length,
      limit: safeLimit,
      offset,
    };
  }

  async getChat(chatId, userId) {
    return db.transaction(async (trx) => {
      const chat = await trx('chats as c')
        .join('chat_participants as me', 'me.chat_id', 'c.id')
        .where('c.id', chatId)
        .where('me.user_id', userId)
        .whereNull('me.deleted_at')
        .select(
          'c.id',
          'c.user_id_1',
          'c.user_id_2',
          'c.order_id',
          'c.last_message_at',
          'c.created_at',
        )
        .first();

      if (!chat) {
        return { error: 'CHAT_NOT_FOUND' };
      }

      const messageRows = await trx('messages')
        .where({ chat_id: chatId })
        .whereNull('deleted_at')
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .limit(MESSAGES_LIMIT)
        .select('id', 'sender_id', 'content', 'message_type', 'attachment_url', 'created_at');

      const me = await trx('chat_participants').where({ chat_id: chatId, user_id: userId }).first();

      let unreadQuery = trx('messages')
        .where({ chat_id: chatId })
        .where('sender_id', '<>', userId)
        .whereNull('deleted_at');
      if (me && me.last_read_at) {
        unreadQuery = unreadQuery.where('created_at', '>', me.last_read_at);
      }
      const [{ total }] = await unreadQuery.count('* as total');

      await trx('chat_participants')
        .where({ chat_id: chatId, user_id: userId })
        .update({ last_read_at: trx.fn.now() });

      return {
        chat: this.formatChat(chat),
        messages: messageRows.reverse().map((row) => this.formatMessage(row)),
        unread_count: Number(total),
      };
    });
  }

  async deleteChat(chatId, userId) {
    const deleted = await db('chat_participants')
      .where({ chat_id: chatId, user_id: userId })
      .whereNull('deleted_at')
      .update({ deleted_at: db.fn.now() });

    if (deleted > 0) {
      logger.info('[AUDITORIA] Chat eliminado (soft delete)', {
        chat_id: chatId,
        user_id: userId,
        timestamp: new Date().toISOString(),
      });
    }

    return deleted > 0;
  }
}

export default new ChatService();
