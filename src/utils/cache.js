import { createClient } from 'redis';
import logger from '../utils/logger.js';

class CacheService {
  constructor() {
    this.client = null;
    this.useRedis = false;
    this.connectAttempted = false;
    this.memory = new Map();
  }

  /**
   * Conecta con Redis si REDIS_URL está configurado. Si no hay URL o la
   * conexión falla, degrada a una caché en memoria con el mismo comportamiento
   * de TTL para no romper el servicio.
   */
  async connect() {
    if (this.connectAttempted) return;
    this.connectAttempted = true;

    const url = process.env.REDIS_URL;
    if (!url) {
      logger.warn('REDIS_URL no configurado. Usando caché en memoria.');
      return;
    }

    try {
      this.client = createClient({ url });
      this.client.on('error', (err) => {
        if (this.useRedis) {
          logger.error('Error de conexión Redis, degradando a caché en memoria:', err.message);
          this.useRedis = false;
        }
      });
      await this.client.connect();
      this.useRedis = true;
      logger.info('Caché Redis conectada.');
    } catch (err) {
      this.useRedis = false;
      logger.error('No se pudo conectar a Redis. Usando caché en memoria:', err.message);
    }
  }

  async disconnect() {
    if (this.client && this.useRedis) {
      await this.client.quit();
    }
  }

  async get(key) {
    if (this.useRedis && this.client) {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    }

    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ttlSeconds) {
    if (this.useRedis && this.client) {
      await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
      return;
    }

    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

export default new CacheService();
