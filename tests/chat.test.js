import { jest } from '@jest/globals';

const builders = {};

const makeBuilder = () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'chat-uuid' }]),
    update: jest.fn().mockResolvedValue(1),
    onConflict: jest.fn().mockReturnThis(),
    merge: jest.fn().mockResolvedValue([1]),
    join: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    joinRaw: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhereRaw: jest.fn().mockReturnThis(),
    whereExists: jest.fn(function (cb) {
      return this;
    }),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue([{ total: '0' }]),
  };
  return builder;
};

const mockKnex = jest.fn();

const setupMockKnex = () => {
  mockKnex.mockImplementation((table) => {
    if (!builders[table]) {
      builders[table] = makeBuilder();
    }
    return builders[table];
  });
  mockKnex.transaction = jest.fn(async (cb) => {
    const trx = jest.fn((table) => {
      if (!builders[table]) {
        builders[table] = makeBuilder();
      }
      return builders[table];
    });
    trx.fn = { now: () => new Date() };
    return cb(trx);
  });
  mockKnex.raw = jest.fn((val) => val);
  mockKnex.fn = { now: () => new Date() };
};

setupMockKnex();

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));

const { default: chatService } = await import('../src/services/ChatService.js');
const { default: chatController } = await import('../src/controllers/ChatController.js');
const { createChatSchema, listChatsQuerySchema } = await import('../src/utils/validation.js');

const UUID1 = '11111111-1111-1111-1111-111111111111';
const UUID2 = '22222222-2222-2222-2222-222222222222';
const CHAT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const resetBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
  setupMockKnex();
};

describe('ChatService', () => {
  beforeEach(resetBuilders);

  describe('canonicalPair', () => {
    it('should order the pair so user_id_1 < user_id_2', () => {
      expect(chatService.canonicalPair('b', 'a')).toEqual(['a', 'b']);
      expect(chatService.canonicalPair('a', 'b')).toEqual(['a', 'b']);
    });
  });

  describe('createChat', () => {
    it('should reject creating a chat with yourself', async () => {
      const result = await chatService.createChat(UUID1, { user_id_2: UUID1 });
      expect(result).toEqual({ error: 'SAME_USER' });
    });

    it('should return USER_NOT_FOUND when one user does not exist', async () => {
      builders.users = makeBuilder();
      builders.users.select.mockResolvedValue([{ id: UUID1 }]);

      const result = await chatService.createChat(UUID1, { user_id_2: UUID2 });
      expect(result).toEqual({ error: 'USER_NOT_FOUND' });
      expect(mockKnex).toHaveBeenCalledWith('users');
    });

    it('should return existing chat with created=false and reactivate participant', async () => {
      builders.users = makeBuilder();
      builders.users.select.mockResolvedValue([{ id: UUID1 }, { id: UUID2 }]);
      builders.chats = makeBuilder();
      builders.chats.first.mockResolvedValue({ id: CHAT_ID });

      const result = await chatService.createChat(UUID1, { user_id_2: UUID2 });

      expect(result).toEqual({ chat_id: CHAT_ID, created: false });
      expect(builders.chat_participants.merge).toHaveBeenCalledWith({ deleted_at: null });
      expect(mockKnex.transaction).not.toHaveBeenCalled();
    });

    it('should create a new chat and its participants in one transaction', async () => {
      builders.users = makeBuilder();
      builders.users.select.mockResolvedValue([{ id: UUID1 }, { id: UUID2 }]);
      builders.chats = makeBuilder();
      builders.chats.first.mockResolvedValue(null);

      const result = await chatService.createChat(UUID1, { user_id_2: UUID2 });

      expect(result).toEqual({ chat_id: 'chat-uuid', created: true });
      expect(mockKnex.transaction).toHaveBeenCalled();
      expect(builders['chat_participants'].insert).toHaveBeenCalledWith([
        { chat_id: 'chat-uuid', user_id: UUID1 },
        { chat_id: 'chat-uuid', user_id: UUID2 },
      ]);
    });

    it('should recover from a unique-violation race returning the existing chat', async () => {
      builders.users = makeBuilder();
      builders.users.select.mockResolvedValue([{ id: UUID1 }, { id: UUID2 }]);
      builders.chats = makeBuilder();
      builders.chats.first.mockResolvedValue(null);

      mockKnex.transaction.mockImplementationOnce(async () => {
        const err = new Error('duplicate key');
        err.code = '23505';
        throw err;
      });
      builders.chats.first.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: CHAT_ID });

      const result = await chatService.createChat(UUID1, { user_id_2: UUID2 });

      expect(result).toEqual({ chat_id: CHAT_ID, created: false });
    });
  });

  describe('listChats', () => {
    it('should format chats with last message, other user and unread count', async () => {
      builders['chats as c'] = makeBuilder();
      builders['chats as c'].offset.mockResolvedValue([
        {
          chat_id: CHAT_ID,
          order_id: null,
          last_message_at: new Date('2026-08-07T13:00:00Z'),
          other_user_id: UUID2,
          other_full_name: 'Carlos García',
          other_avatar_url: null,
          last_message_content: 'Hola',
          last_message_sender_id: UUID2,
          last_message_created_at: new Date('2026-08-07T13:00:00Z'),
          unread_count: '2',
        },
      ]);

      const result = await chatService.listChats(UUID1, { limit: 20, offset: 0 });

      expect(result.count).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
      expect(result.chats[0].unread_count).toBe(2);
      expect(result.chats[0].last_message).toEqual({
        content: 'Hola',
        sender_id: UUID2,
        created_at: new Date('2026-08-07T13:00:00Z'),
      });
      expect(result.chats[0].other_user.user_id).toBe(UUID2);
      expect(result.chats[0].other_user.full_name).toBe('Carlos García');
      expect(builders['chats as c'].orderBy).toHaveBeenCalledWith('c.last_message_at', 'desc');
    });

    it('should set last_message to null when the chat has no messages', async () => {
      builders['chats as c'] = makeBuilder();
      builders['chats as c'].offset.mockResolvedValue([
        {
          chat_id: CHAT_ID,
          order_id: null,
          last_message_at: new Date(),
          other_user_id: UUID2,
          other_full_name: null,
          other_avatar_url: null,
          last_message_content: null,
          last_message_sender_id: null,
          last_message_created_at: null,
          unread_count: '0',
        },
      ]);

      const result = await chatService.listChats(UUID1, {});

      expect(result.chats[0].last_message).toBeNull();
      expect(result.chats[0].unread_count).toBe(0);
      expect(result.limit).toBe(20);
    });

    it('should clamp limit to the allowed range', async () => {
      builders['chats as c'] = makeBuilder();
      await chatService.listChats(UUID1, { limit: 999, offset: 0 });
      expect(builders['chats as c'].limit).toHaveBeenCalledWith(100);
    });

    it('should include is_favorite and is_archived in the response', async () => {
      builders['chats as c'] = makeBuilder();
      builders['chats as c'].offset.mockResolvedValue([
        {
          chat_id: CHAT_ID,
          order_id: null,
          last_message_at: new Date(),
          is_favorite: true,
          is_archived: false,
          other_user_id: UUID2,
          other_full_name: 'Carlos García',
          other_avatar_url: null,
          last_message_content: null,
          last_message_sender_id: null,
          last_message_created_at: null,
          unread_count: '0',
        },
      ]);

      const result = await chatService.listChats(UUID1, {});
      expect(result.chats[0].is_favorite).toBe(true);
      expect(result.chats[0].is_archived).toBe(false);
    });

    it('should order favorites first, then by last_message_at desc', async () => {
      builders['chats as c'] = makeBuilder();
      await chatService.listChats(UUID1, {});
      expect(builders['chats as c'].orderBy).toHaveBeenNthCalledWith(1, 'me.is_favorite', 'desc');
      expect(builders['chats as c'].orderBy).toHaveBeenNthCalledWith(
        2,
        'c.last_message_at',
        'desc',
      );
    });

    it('should filter favorites and exclude archived chats', async () => {
      builders['chats as c'] = makeBuilder();
      await chatService.listChats(UUID1, { status: 'favorites' });
      expect(builders['chats as c'].where).toHaveBeenCalledWith('me.is_favorite', true);
      expect(builders['chats as c'].where).toHaveBeenCalledWith('me.is_archived', false);
    });

    it('should filter chats with an active order', async () => {
      builders['chats as c'] = makeBuilder();
      await chatService.listChats(UUID1, { status: 'active' });
      expect(builders['chats as c'].whereExists).toHaveBeenCalled();
      expect(builders['chats as c'].where).toHaveBeenCalledWith('me.is_archived', false);
    });

    it('should filter archived chats and not exclude archived', async () => {
      builders['chats as c'] = makeBuilder();
      await chatService.listChats(UUID1, { status: 'archived' });
      expect(builders['chats as c'].where).toHaveBeenCalledWith('me.is_archived', true);
      expect(builders['chats as c'].where).not.toHaveBeenCalledWith('me.is_archived', false);
    });

    it('should apply the search filter by other user full_name', async () => {
      builders['chats as c'] = makeBuilder();
      await chatService.listChats(UUID1, { search: 'carlos' });
      expect(builders['chats as c'].andWhereRaw).toHaveBeenCalledWith(
        'COALESCE(owp.full_name, ocp.full_name) ILIKE ?',
        ['%carlos%'],
      );
    });
  });

  describe('getChat', () => {
    it('should return CHAT_NOT_FOUND when user is not a participant', async () => {
      builders['chats as c'] = makeBuilder();
      builders['chats as c'].first.mockResolvedValue(null);

      const result = await chatService.getChat(CHAT_ID, UUID1);

      expect(result).toEqual({ error: 'CHAT_NOT_FOUND' });
    });

    it('should return chat, last 50 messages and mark as read', async () => {
      builders['chats as c'] = makeBuilder();
      builders['chats as c'].first.mockResolvedValue({
        id: CHAT_ID,
        user_id_1: UUID1,
        user_id_2: UUID2,
        order_id: null,
        last_message_at: new Date('2026-08-07T13:00:00Z'),
        created_at: new Date('2026-08-07T12:00:00Z'),
      });
      builders.messages = makeBuilder();
      const msgNew = {
        id: 'msg-2',
        sender_id: UUID2,
        content: 'Segundo',
        message_type: 'TEXT',
        attachment_url: null,
        created_at: new Date('2026-08-07T13:00:00Z'),
      };
      const msgOld = {
        id: 'msg-1',
        sender_id: UUID1,
        content: 'Primero',
        message_type: 'TEXT',
        attachment_url: null,
        created_at: new Date('2026-08-07T12:00:00Z'),
      };
      builders.messages.select.mockResolvedValue([msgNew, msgOld]);
      builders.chat_participants = makeBuilder();
      builders.chat_participants.first.mockResolvedValue({ last_read_at: null });
      builders.messages.count.mockResolvedValue([{ total: '1' }]);

      const result = await chatService.getChat(CHAT_ID, UUID1);

      expect(result.error).toBeUndefined();
      expect(result.chat.chat_id).toBe(CHAT_ID);
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].content).toBe('Primero');
      expect(result.messages[1].content).toBe('Segundo');
      expect(result.unread_count).toBe(1);
      expect(builders.chat_participants.update).toHaveBeenCalledWith({
        last_read_at: expect.any(Date),
      });
    });
  });

  describe('deleteChat', () => {
    it('should return true when the participant row is updated', async () => {
      builders.chat_participants = makeBuilder();
      builders.chat_participants.update.mockResolvedValue(1);

      const result = await chatService.deleteChat(CHAT_ID, UUID1);

      expect(result).toBe(true);
      expect(builders.chat_participants.where).toHaveBeenCalledWith({
        chat_id: CHAT_ID,
        user_id: UUID1,
      });
    });

    it('should return false when nothing was deleted', async () => {
      builders.chat_participants = makeBuilder();
      builders.chat_participants.update.mockResolvedValue(0);

      const result = await chatService.deleteChat(CHAT_ID, UUID1);

      expect(result).toBe(false);
    });
  });
});

describe('Chat Validation Schema', () => {
  describe('createChatSchema', () => {
    it('should accept valid data', () => {
      const { error } = createChatSchema.validate({
        user_id_2: UUID2,
        order_id: CHAT_ID,
      });
      expect(error).toBeUndefined();
    });

    it('should accept data without order_id', () => {
      const { error } = createChatSchema.validate({ user_id_2: UUID2 });
      expect(error).toBeUndefined();
    });

    it('should require user_id_2', () => {
      const { error } = createChatSchema.validate({});
      expect(error).toBeDefined();
    });

    it('should reject an invalid UUID', () => {
      const { error } = createChatSchema.validate({ user_id_2: 'not-a-uuid' });
      expect(error).toBeDefined();
    });
  });

  describe('listChatsQuerySchema', () => {
    it('should apply default limit and offset', () => {
      const { error, value } = listChatsQuerySchema.validate({});
      expect(error).toBeUndefined();
      expect(value).toEqual({ limit: 20, offset: 0 });
    });

    it('should reject limit above 100', () => {
      const { error } = listChatsQuerySchema.validate({ limit: 500 });
      expect(error).toBeDefined();
    });

    it('should reject negative offset', () => {
      const { error } = listChatsQuerySchema.validate({ offset: -1 });
      expect(error).toBeDefined();
    });

    it('should accept a valid status filter', () => {
      const { error, value } = listChatsQuerySchema.validate({ status: 'active' });
      expect(error).toBeUndefined();
      expect(value.status).toBe('active');
    });

    it('should reject an unknown status value', () => {
      const { error } = listChatsQuerySchema.validate({ status: 'pinned' });
      expect(error).toBeDefined();
    });

    it('should accept and trim a search term', () => {
      const { error, value } = listChatsQuerySchema.validate({ search: '  carlos ' });
      expect(error).toBeUndefined();
      expect(value.search).toBe('carlos');
    });

    it('should not require status nor search by default', () => {
      const { error, value } = listChatsQuerySchema.validate({});
      expect(error).toBeUndefined();
      expect(value.status).toBeUndefined();
      expect(value.search).toBeUndefined();
    });
  });
});

describe('ChatController', () => {
  beforeEach(resetBuilders);

  describe('create', () => {
    it('should return 400 for invalid body', async () => {
      const req = { user: { user_id: UUID1 }, body: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when trying to chat with yourself', async () => {
      const req = { user: { user_id: UUID1 }, body: { user_id_2: UUID1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json.mock.calls[0][0].error).toBe('SAME_USER');
    });

    it('should return 404 when one user does not exist', async () => {
      builders.users = makeBuilder();
      builders.users.select.mockResolvedValue([{ id: UUID1 }]);
      const req = { user: { user_id: UUID1 }, body: { user_id_2: UUID2 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json.mock.calls[0][0].error).toBe('USER_NOT_FOUND');
    });

    it('should return 201 when the chat is created', async () => {
      builders.users = makeBuilder();
      builders.users.select.mockResolvedValue([{ id: UUID1 }, { id: UUID2 }]);
      builders.chats = makeBuilder();
      builders.chats.first.mockResolvedValue(null);
      const req = { user: { user_id: UUID1 }, body: { user_id_2: UUID2 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json.mock.calls[0][0].chat_id).toBe('chat-uuid');
      expect(res.json.mock.calls[0][0].created).toBe(true);
    });

    it('should return 200 when the chat already exists', async () => {
      builders.users = makeBuilder();
      builders.users.select.mockResolvedValue([{ id: UUID1 }, { id: UUID2 }]);
      builders.chats = makeBuilder();
      builders.chats.first.mockResolvedValue({ id: CHAT_ID });
      const req = { user: { user_id: UUID1 }, body: { user_id_2: UUID2 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.create(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].chat_id).toBe(CHAT_ID);
      expect(res.json.mock.calls[0][0].created).toBe(false);
    });
  });

  describe('list', () => {
    it('should return 403 for another user', async () => {
      const req = {
        params: { id: 'other-user' },
        user: { user_id: UUID1 },
        query: {},
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.list(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 400 for invalid query params', async () => {
      const req = {
        params: { id: UUID1 },
        user: { user_id: UUID1 },
        query: { limit: 0 },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.list(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 200 with the list of chats', async () => {
      builders['chats as c'] = makeBuilder();
      builders['chats as c'].offset.mockResolvedValue([
        {
          chat_id: CHAT_ID,
          order_id: null,
          last_message_at: new Date(),
          other_user_id: UUID2,
          other_full_name: 'Carlos García',
          other_avatar_url: null,
          last_message_content: 'Hola',
          last_message_sender_id: UUID2,
          last_message_created_at: new Date(),
          unread_count: '1',
        },
      ]);
      const req = {
        params: { id: UUID1 },
        user: { user_id: UUID1 },
        query: {},
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.list(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].count).toBe(1);
      expect(res.json.mock.calls[0][0].chats[0].unread_count).toBe(1);
    });
  });

  describe('getById', () => {
    it('should return 404 when the chat is not accessible', async () => {
      builders['chats as c'] = makeBuilder();
      builders['chats as c'].first.mockResolvedValue(null);
      const req = { params: { chat_id: CHAT_ID }, user: { user_id: UUID1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.getById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json.mock.calls[0][0].error).toBe('CHAT_NOT_FOUND');
    });

    it('should return 200 with chat, messages and unread_count', async () => {
      builders['chats as c'] = makeBuilder();
      builders['chats as c'].first.mockResolvedValue({
        id: CHAT_ID,
        user_id_1: UUID1,
        user_id_2: UUID2,
        order_id: null,
        last_message_at: new Date(),
        created_at: new Date(),
      });
      builders.messages = makeBuilder();
      builders.messages.select.mockResolvedValue([
        {
          id: 'msg-1',
          sender_id: UUID2,
          content: 'Hola',
          message_type: 'TEXT',
          attachment_url: null,
          created_at: new Date(),
        },
      ]);
      builders.chat_participants = makeBuilder();
      builders.chat_participants.first.mockResolvedValue({ last_read_at: null });
      builders.messages.count.mockResolvedValue([{ total: '1' }]);
      const req = { params: { chat_id: CHAT_ID }, user: { user_id: UUID1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.getById(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].messages).toHaveLength(1);
      expect(res.json.mock.calls[0][0].unread_count).toBe(1);
    });
  });

  describe('remove', () => {
    it('should return 404 when the chat is not accessible', async () => {
      builders.chat_participants = makeBuilder();
      builders.chat_participants.update.mockResolvedValue(0);
      const req = { params: { chat_id: CHAT_ID }, user: { user_id: UUID1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.remove(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 200 on successful soft delete', async () => {
      builders.chat_participants = makeBuilder();
      builders.chat_participants.update.mockResolvedValue(1);
      const req = { params: { chat_id: CHAT_ID }, user: { user_id: UUID1 } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await chatController.remove(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].message).toBe('Chat eliminado correctamente');
    });
  });
});
