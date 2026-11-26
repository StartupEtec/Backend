import { jest } from '@jest/globals';

const builders = {};

const makeBuilder = () => {
  const builder = {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
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
};

setupMockKnex();

jest.unstable_mockModule('../src/database/db.js', () => ({ default: mockKnex }));
jest.unstable_mockModule('../src/services/AuthService.js', () => ({
  default: { verifyAccessToken: jest.fn() },
}));

const { default: websocketHub } = await import('../src/utils/websocket.js');
const authService = (await import('../src/services/AuthService.js')).default;

const CHAT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

const makeSocket = () => ({
  readyState: 1,
  on: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
});

const resetBuilders = () => {
  Object.keys(builders).forEach((key) => delete builders[key]);
  setupMockKnex();
};

describe('WebSocketHub.handleConnection', () => {
  beforeEach(() => {
    resetBuilders();
    jest.clearAllMocks();
    websocketHub.clients.clear();
  });

  test('registra la conexión con token válido y envía evento connected', () => {
    authService.verifyAccessToken.mockReturnValue({ user_id: USER_A });
    const socket = makeSocket();
    const req = { url: `/ws?token=valid` };

    websocketHub.handleConnection(socket, req);

    expect(socket.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'connected', payload: { user_id: USER_A } }),
    );
    expect(websocketHub.clients.get(USER_A).has(socket)).toBe(true);
  });

  test('cierra la conexión con token inválido', () => {
    authService.verifyAccessToken.mockReturnValue(null);
    const socket = makeSocket();

    websocketHub.handleConnection(socket, { url: '/ws?token=bad' });

    expect(socket.close).toHaveBeenCalledWith(1008, 'Token inválido');
    expect(websocketHub.clients.size).toBe(0);
  });

  test('cierra la conexión sin token', () => {
    const socket = makeSocket();

    websocketHub.handleConnection(socket, { url: '/ws' });

    expect(socket.close).toHaveBeenCalledWith(1008, 'Token inválido');
  });
});

describe('WebSocketHub.sendToUser / removeClient', () => {
  beforeEach(() => {
    resetBuilders();
    jest.clearAllMocks();
    websocketHub.clients.clear();
  });

  test('envía el evento solo a sockets abiertos del usuario', () => {
    const openSocket = makeSocket();
    const closedSocket = makeSocket();
    closedSocket.readyState = 3;
    websocketHub.clients.set(USER_A, new Set([openSocket, closedSocket]));

    websocketHub.sendToUser(USER_A, 'message:new', { chat_id: CHAT_ID });

    expect(openSocket.send).toHaveBeenCalledTimes(1);
    expect(closedSocket.send).not.toHaveBeenCalled();
  });

  test('no hace nada si el usuario no tiene conexiones', () => {
    websocketHub.sendToUser(USER_A, 'message:new', {});
  });

  test('elimina el socket del mapa al desconectarse', () => {
    const socket = makeSocket();
    websocketHub.clients.set(USER_A, new Set([socket]));

    websocketHub.removeClient(USER_A, socket);

    expect(websocketHub.clients.has(USER_A)).toBe(false);
  });
});

describe('WebSocketHub.relayTyping', () => {
  beforeEach(() => {
    resetBuilders();
    jest.clearAllMocks();
    websocketHub.clients.clear();
    mockKnex('chat_participants');
  });

  test('releva user:typing a los demás participantes del chat', async () => {
    const otherSocket = makeSocket();
    websocketHub.clients.set(USER_B, new Set([otherSocket]));
    builders['chat_participants'].first.mockResolvedValue({ chat_id: CHAT_ID, user_id: USER_A });
    builders['chat_participants'].select.mockResolvedValue([{ user_id: USER_B }]);

    await websocketHub.relayTyping(USER_A, CHAT_ID, true);

    expect(otherSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'user:typing',
        payload: { chat_id: CHAT_ID, user_id: USER_A, is_typing: true },
      }),
    );
  });

  test('ignora si el usuario no participa activamente del chat', async () => {
    const otherSocket = makeSocket();
    websocketHub.clients.set(USER_B, new Set([otherSocket]));
    builders['chat_participants'].first.mockResolvedValue(null);

    await websocketHub.relayTyping(USER_A, CHAT_ID, true);

    expect(otherSocket.send).not.toHaveBeenCalled();
  });
});

describe('WebSocketHub.handleClientMessage', () => {
  beforeEach(() => {
    resetBuilders();
    jest.clearAllMocks();
    websocketHub.clients.clear();
    mockKnex('chat_participants');
  });

  test('procesa el evento user:typing del cliente', async () => {
    const relaySpy = jest.spyOn(websocketHub, 'relayTyping').mockResolvedValue(undefined);
    builders['chat_participants'].first.mockResolvedValue({ chat_id: CHAT_ID, user_id: USER_A });

    await websocketHub.handleClientMessage(
      USER_A,
      JSON.stringify({ type: 'user:typing', chat_id: CHAT_ID, is_typing: true }),
    );

    expect(relaySpy).toHaveBeenCalledWith(USER_A, CHAT_ID, true);
    relaySpy.mockRestore();
  });

  test('ignora mensajes con JSON inválido', async () => {
    const relaySpy = jest.spyOn(websocketHub, 'relayTyping').mockResolvedValue(undefined);

    await websocketHub.handleClientMessage(USER_A, 'not-json');

    expect(relaySpy).not.toHaveBeenCalled();
    relaySpy.mockRestore();
  });
});
