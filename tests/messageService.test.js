import { jest } from '@jest/globals';

const builders = {};

const makeBuilder = () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 'msg-uuid' }]),
    update: jest.fn().mockResolvedValue(1),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockResolvedValue([]),
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
  mockKnex.fn = { now: () => new Date() };
};

setupMockKnex();

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));
jest.unstable_mockModule('../src/services/ImageService.js', () => ({
  default: {
    compressAndStoreImage: jest.fn(),
    deleteStoredFile: jest.fn().mockResolvedValue(true),
  },
}));
jest.unstable_mockModule('../src/utils/websocket.js', () => ({
  default: { sendToUser: jest.fn(), sendToUsers: jest.fn() },
}));

const { default: messageService } = await import('../src/services/MessageService.js');
const imageService = (await import('../src/services/ImageService.js')).default;
const websocketHub = (await import('../src/utils/websocket.js')).default;
const { createMessageSchema, listMessagesQuerySchema } = await import('../src/utils/validation.js');

const CHAT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const MESSAGE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const makeMessageRow = (overrides = {}) => ({
  id: MESSAGE_ID,
  chat_id: CHAT_ID,
  sender_id: USER_A,
  content: 'Hola',
  message_type: 'TEXT',
  attachment_url: null,
  created_at: new Date('2026-08-07T13:00:00Z'),
  ...overrides,
});

const resetBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
  setupMockKnex();
};

describe('MessageService.createMessage', () => {
  beforeEach(() => {
    resetBuilders();
    jest.clearAllMocks();
    mockKnex('chat_participants');
    mockKnex('messages');
    mockKnex('chats');
    imageService.deleteStoredFile.mockResolvedValue(true);
    builders['chat_participants'].first.mockResolvedValue({ chat_id: CHAT_ID, user_id: USER_A });
    builders['chat_participants'].select.mockResolvedValue([{ user_id: USER_B }]);
    builders['messages'].returning.mockResolvedValue([makeMessageRow()]);
  });

  test('crea un mensaje de texto y notifica al otro participante', async () => {
    const result = await messageService.createMessage(CHAT_ID, USER_A, {
      message_type: 'TEXT',
      content: 'Hola',
    });

    expect(result.error).toBeUndefined();
    expect(result.message.content).toBe('Hola');
    expect(result.message.message_type).toBe('TEXT');
    expect(builders['chats'].update).toHaveBeenCalled();
    expect(websocketHub.sendToUsers).toHaveBeenCalledWith(
      [USER_B],
      'message:new',
      expect.objectContaining({ chat_id: CHAT_ID }),
    );
  });

  test('devuelve CHAT_NOT_FOUND si el usuario no participa en el chat', async () => {
    builders['chat_participants'].first.mockResolvedValue(null);

    const result = await messageService.createMessage(CHAT_ID, USER_A, {
      message_type: 'TEXT',
      content: 'Hola',
    });

    expect(result.error).toBe('CHAT_NOT_FOUND');
    expect(builders['messages'].insert).not.toHaveBeenCalled();
  });

  test('requiere archivo adjunto para mensajes IMAGE', async () => {
    const result = await messageService.createMessage(CHAT_ID, USER_A, {
      message_type: 'IMAGE',
    });

    expect(result.error).toBe('IMAGE_REQUIRED');
    expect(imageService.compressAndStoreImage).not.toHaveBeenCalled();
  });

  test('almacena y comprime la imagen adjunta para mensajes IMAGE', async () => {
    const buffer = Buffer.from('fake-jpeg');
    imageService.compressAndStoreImage.mockResolvedValue({ url: '/uploads/messages/a.jpg' });
    builders['messages'].returning.mockResolvedValue([
      makeMessageRow({
        message_type: 'IMAGE',
        content: null,
        attachment_url: '/uploads/messages/a.jpg',
      }),
    ]);

    const result = await messageService.createMessage(
      CHAT_ID,
      USER_A,
      { message_type: 'IMAGE' },
      { buffer, mimetype: 'image/jpeg' },
    );

    expect(imageService.compressAndStoreImage).toHaveBeenCalledWith(buffer);
    expect(result.message.attachment_url).toBe('/uploads/messages/a.jpg');
  });

  test('propaga el error de imagen inválida', async () => {
    imageService.compressAndStoreImage.mockResolvedValue({ error: 'INVALID_IMAGE_TYPE' });

    const result = await messageService.createMessage(
      CHAT_ID,
      USER_A,
      { message_type: 'IMAGE' },
      { buffer: Buffer.from('x'), mimetype: 'image/gif' },
    );

    expect(result.error).toBe('INVALID_IMAGE_TYPE');
  });

  test('elimina el archivo almacenado si la transacción falla', async () => {
    imageService.compressAndStoreImage.mockResolvedValue({ url: '/uploads/messages/a.jpg' });
    mockKnex.transaction = jest.fn(async () => {
      throw new Error('db error');
    });

    await expect(
      messageService.createMessage(
        CHAT_ID,
        USER_A,
        { message_type: 'IMAGE' },
        { buffer: Buffer.from('x') },
      ),
    ).rejects.toThrow('db error');

    expect(imageService.deleteStoredFile).toHaveBeenCalledWith('/uploads/messages/a.jpg');
  });
});

describe('MessageService.listMessages', () => {
  beforeEach(() => {
    resetBuilders();
    jest.clearAllMocks();
    mockKnex('chat_participants');
    mockKnex('messages');
    builders['chat_participants'].first.mockResolvedValue({ chat_id: CHAT_ID, user_id: USER_A });
  });

  test('devuelve mensajes paginados en orden cronológico y marca como leído', async () => {
    const older = makeMessageRow({ id: 'msg-1', content: 'Primero' });
    const newer = makeMessageRow({ id: 'msg-2', content: 'Segundo' });
    builders['messages'].offset.mockResolvedValue([newer, older]);

    const result = await messageService.listMessages(CHAT_ID, USER_A, { limit: 50, offset: 0 });

    expect(result.messages[0].content).toBe('Primero');
    expect(result.messages[1].content).toBe('Segundo');
    expect(result.count).toBe(2);
    expect(builders['chat_participants'].update).toHaveBeenCalledWith(
      expect.objectContaining({ last_read_at: expect.any(Date) }),
    );
  });

  test('devuelve CHAT_NOT_FOUND si el usuario no participa', async () => {
    builders['chat_participants'].first.mockResolvedValue(null);

    const result = await messageService.listMessages(CHAT_ID, USER_A, { limit: 50, offset: 0 });

    expect(result.error).toBe('CHAT_NOT_FOUND');
  });

  test('aplica límites a la paginación', async () => {
    const result = await messageService.listMessages(CHAT_ID, USER_A, { limit: 500, offset: 0 });

    expect(result.limit).toBe(100);
  });
});

describe('MessageService.deleteMessage', () => {
  beforeEach(() => {
    resetBuilders();
    jest.clearAllMocks();
    mockKnex('messages');
    mockKnex('chat_participants');
    builders['messages'].first.mockResolvedValue(makeMessageRow({ sender_id: USER_A }));
    builders['chat_participants'].select.mockResolvedValue([{ user_id: USER_B }]);
  });

  test('elimina (soft delete) el mensaje y notifica al otro participante', async () => {
    const result = await messageService.deleteMessage(MESSAGE_ID, USER_A);

    expect(result.deleted).toBe(true);
    expect(builders['messages'].update).toHaveBeenCalled();
    expect(websocketHub.sendToUsers).toHaveBeenCalledWith(
      [USER_B],
      'message:deleted',
      expect.objectContaining({ message_id: MESSAGE_ID }),
    );
  });

  test('devuelve MESSAGE_NOT_FOUND si no existe o ya fue eliminado', async () => {
    builders['messages'].first.mockResolvedValue(null);
    expect((await messageService.deleteMessage(MESSAGE_ID, USER_A)).error).toBe(
      'MESSAGE_NOT_FOUND',
    );

    builders['messages'].first.mockResolvedValue(makeMessageRow({ deleted_at: new Date() }));
    expect((await messageService.deleteMessage(MESSAGE_ID, USER_A)).error).toBe(
      'MESSAGE_NOT_FOUND',
    );
  });

  test('solo el autor puede eliminar el mensaje', async () => {
    builders['messages'].first.mockResolvedValue(makeMessageRow({ sender_id: USER_B }));

    const result = await messageService.deleteMessage(MESSAGE_ID, USER_A);

    expect(result.error).toBe('FORBIDDEN');
    expect(builders['messages'].update).not.toHaveBeenCalled();
  });
});

describe('Message Validation Schemas', () => {
  test('createMessageSchema exige content para TEXT y QUOTE', () => {
    expect(createMessageSchema.validate({ message_type: 'TEXT' }).error).toBeDefined();
    expect(createMessageSchema.validate({ message_type: 'QUOTE' }).error).toBeDefined();
    expect(
      createMessageSchema.validate({ message_type: 'TEXT', content: 'Hola' }).error,
    ).toBeUndefined();
    expect(
      createMessageSchema.validate({ message_type: 'QUOTE', content: 'Cotización' }).error,
    ).toBeUndefined();
    expect(createMessageSchema.validate({ content: 'Hola' }).value.message_type).toBe('TEXT');
  });

  test('createMessageSchema permite IMAGE sin content', () => {
    const { error, value } = createMessageSchema.validate({ message_type: 'IMAGE' });
    expect(error).toBeUndefined();
    expect(value.message_type).toBe('IMAGE');
  });

  test('createMessageSchema rechaza tipos inválidos', () => {
    expect(createMessageSchema.validate({ message_type: 'VIDEO' }).error).toBeDefined();
  });

  test('listMessagesQuerySchema aplica defaults y límites', () => {
    expect(listMessagesQuerySchema.validate({}).value).toEqual({ limit: 50, offset: 0 });
    expect(listMessagesQuerySchema.validate({ limit: 200 }).error).toBeDefined();
  });
});
