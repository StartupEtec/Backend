import { WebSocketServer, WebSocket } from 'ws';
import db from '../database/db.js';
import authService from '../services/AuthService.js';
import logger from '../utils/logger.js';

const WS_PATH = '/ws';

class WebSocketHub {
  constructor() {
    this.wss = null;
    this.clients = new Map();
  }

  attach(server) {
    this.wss = new WebSocketServer({ server, path: WS_PATH });
    this.wss.on('connection', (socket, req) => this.handleConnection(socket, req));
    logger.info(`WebSocket listo en ${WS_PATH}`);
  }

  handleConnection(socket, req) {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    const payload = token ? authService.verifyAccessToken(token) : null;

    if (!payload || !payload.user_id) {
      socket.close(1008, 'Token inválido');
      return;
    }

    const userId = payload.user_id;
    socket.user_id = userId;

    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(socket);

    socket.on('message', (data) => {
      this.handleClientMessage(userId, data);
    });
    socket.on('close', () => {
      this.removeClient(userId, socket);
    });

    socket.send(JSON.stringify({ event: 'connected', payload: { user_id: userId } }));
  }

  async handleClientMessage(userId, data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }

    if (msg.type === 'user:typing') {
      await this.relayTyping(userId, msg.chat_id, Boolean(msg.is_typing));
    }
  }

  async relayTyping(userId, chatId, isTyping) {
    if (!chatId) return;

    const participant = await db('chat_participants')
      .where({ chat_id: chatId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!participant) return;

    const others = await db('chat_participants')
      .where({ chat_id: chatId })
      .where('user_id', '<>', userId)
      .whereNull('deleted_at')
      .select('user_id');

    for (const { user_id } of others) {
      this.sendToUser(user_id, 'user:typing', {
        chat_id: chatId,
        user_id: userId,
        is_typing: isTyping,
      });
    }
  }

  sendToUser(userId, event, payload) {
    const sockets = this.clients.get(userId);
    if (!sockets) return;

    const message = JSON.stringify({ event, payload });
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
      }
    }
  }

  sendToUsers(userIds, event, payload) {
    for (const userId of userIds) {
      this.sendToUser(userId, event, payload);
    }
  }

  removeClient(userId, socket) {
    const sockets = this.clients.get(userId);
    if (!sockets) return;

    sockets.delete(socket);
    if (sockets.size === 0) {
      this.clients.delete(userId);
    }
  }

  close() {
    if (!this.wss) return;

    for (const sockets of this.clients.values()) {
      for (const socket of sockets) {
        socket.close();
      }
    }
    this.clients.clear();
    this.wss.close();
  }
}

export default new WebSocketHub();
