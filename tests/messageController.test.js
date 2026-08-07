import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/services/MessageService.js', () => ({
  default: {
    createMessage: jest.fn(),
    listMessages: jest.fn(),
    deleteMessage: jest.fn(),
  },
}));

const { default: messageController } = await import('../src/controllers/MessageController.js');
const messageService = (await import('../src/services/MessageService.js')).default;

const CHAT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A = '11111111-1111-1111-1111-111111111111';
const MESSAGE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const makeRes = () => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return res;
};

describe('MessageController.create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('responde 201 con el mensaje creado', async () => {
    messageService.createMessage.mockResolvedValue({
      message: { id: MESSAGE_ID, content: 'Hola', message_type: 'TEXT' },
    });
    const req = {
      params: { chat_id: CHAT_ID },
      user: { user_id: USER_A },
      body: { content: 'Hola' },
      file: null,
    };
    const res = makeRes();

    await messageController.create(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(201);
    expect(messageService.createMessage).toHaveBeenCalledWith(
      CHAT_ID,
      USER_A,
      expect.anything(),
      null,
    );
  });

  test('responde 400 con VALIDATION_ERROR si falta content en TEXT', async () => {
    const req = { params: { chat_id: CHAT_ID }, user: { user_id: USER_A }, body: {}, file: null };
    const res = makeRes();

    await messageController.create(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe('VALIDATION_ERROR');
  });

  test('responde 404 si el chat no existe o no participa', async () => {
    messageService.createMessage.mockResolvedValue({ error: 'CHAT_NOT_FOUND' });
    const req = {
      params: { chat_id: CHAT_ID },
      user: { user_id: USER_A },
      body: { content: 'Hola' },
      file: null,
    };
    const res = makeRes();

    await messageController.create(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error).toBe('CHAT_NOT_FOUND');
  });

  test('responde 400 si falta el archivo en un mensaje IMAGE', async () => {
    messageService.createMessage.mockResolvedValue({ error: 'IMAGE_REQUIRED' });
    const req = {
      params: { chat_id: CHAT_ID },
      user: { user_id: USER_A },
      body: { message_type: 'IMAGE' },
      file: null,
    };
    const res = makeRes();

    await messageController.create(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe('IMAGE_REQUIRED');
  });

  test('responde 400 UPLOAD_ERROR si el archivo excede 5MB (MulterError)', async () => {
    messageService.createMessage.mockRejectedValue({
      name: 'MulterError',
      code: 'LIMIT_FILE_SIZE',
    });
    const req = {
      params: { chat_id: CHAT_ID },
      user: { user_id: USER_A },
      body: { message_type: 'IMAGE' },
      file: null,
    };
    const res = makeRes();

    await messageController.create(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe('UPLOAD_ERROR');
    expect(res.json.mock.calls[0][0].message).toContain('5MB');
  });

  test('responde 400 UPLOAD_ERROR si el tipo de archivo no es JPG/PNG', async () => {
    messageService.createMessage.mockRejectedValue({
      code: 'INVALID_FILE_TYPE',
      message: 'Solo se permiten imágenes JPG o PNG',
    });
    const req = {
      params: { chat_id: CHAT_ID },
      user: { user_id: USER_A },
      body: { message_type: 'IMAGE' },
      file: null,
    };
    const res = makeRes();

    await messageController.create(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe('UPLOAD_ERROR');
  });
});

describe('MessageController.list', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('responde 200 con la lista paginada', async () => {
    messageService.listMessages.mockResolvedValue({ messages: [], count: 0, limit: 50, offset: 0 });
    const req = {
      params: { chat_id: CHAT_ID },
      user: { user_id: USER_A },
      query: {},
    };
    const res = makeRes();

    await messageController.list(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(messageService.listMessages).toHaveBeenCalledWith(CHAT_ID, USER_A, {
      limit: 50,
      offset: 0,
    });
  });

  test('responde 404 si el usuario no participa del chat', async () => {
    messageService.listMessages.mockResolvedValue({ error: 'CHAT_NOT_FOUND' });
    const req = {
      params: { chat_id: CHAT_ID },
      user: { user_id: USER_A },
      query: {},
    };
    const res = makeRes();

    await messageController.list(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('responde 400 con query de paginación inválida', async () => {
    const req = { params: { chat_id: CHAT_ID }, user: { user_id: USER_A }, query: { limit: 0 } };
    const res = makeRes();

    await messageController.list(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(messageService.listMessages).not.toHaveBeenCalled();
  });
});

describe('MessageController.remove', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('responde 200 al eliminar el mensaje', async () => {
    messageService.deleteMessage.mockResolvedValue({ deleted: true });
    const req = { params: { message_id: MESSAGE_ID }, user: { user_id: USER_A } };
    const res = makeRes();

    await messageController.remove(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(messageService.deleteMessage).toHaveBeenCalledWith(MESSAGE_ID, USER_A);
  });

  test('responde 404 si el mensaje no existe', async () => {
    messageService.deleteMessage.mockResolvedValue({ error: 'MESSAGE_NOT_FOUND' });
    const req = { params: { message_id: MESSAGE_ID }, user: { user_id: USER_A } };
    const res = makeRes();

    await messageController.remove(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('responde 403 si no es el autor', async () => {
    messageService.deleteMessage.mockResolvedValue({ error: 'FORBIDDEN' });
    const req = { params: { message_id: MESSAGE_ID }, user: { user_id: USER_A } };
    const res = makeRes();

    await messageController.remove(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toBe('FORBIDDEN');
  });
});
