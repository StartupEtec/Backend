import logger from '../../utils/logger.js';

/**
 * Proveedor de notificaciones push via Firebase Cloud Messaging (FCM).
 * Requiere variables de entorno: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL.
 * En desarrollo sin credenciales, simula el envío y retorna un ID ficticio.
 */
class FirebasePushProvider {
  constructor() {
    this.initialized = false;
    this.admin = null;
    this._initPromise = null;
  }

  _ensureInitialized() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._initialize();
    return this._initPromise;
  }

  async _initialize() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

    if (!projectId || !privateKey || !clientEmail) {
      logger.warn('[NOTIFICATION] Firebase no configurado; push notifications en modo simulación');
      return;
    }

    try {
      const mod = await import('firebase-admin');
      this.admin = mod.default;
      this.admin.initializeApp({
        credential: this.admin.credential.cert({ projectId, privateKey, clientEmail }),
      });
      this.initialized = true;
      logger.info('[NOTIFICATION] Firebase Cloud Messaging inicializado');
    } catch (err) {
      logger.warn('[NOTIFICATION] firebase-admin no disponible; push en modo simulación', {
        error: err.message,
      });
    }
  }

  /**
   * Envía notificación push a un dispositivo.
   * @param {string} token - FCM token del dispositivo.
   * @param {object} payload - { title, body, data }.
   * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
   */
  async send(token, payload) {
    await this._ensureInitialized();

    if (!this.initialized) {
      logger.info('[NOTIFICATION] Push simulado', { token: token?.slice(0, 10) + '...' });
      return { success: true, messageId: `simulated_${Date.now()}` };
    }

    try {
      const message = {
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data || {},
      };

      const messageId = await this.admin.messaging().send(message);
      return { success: true, messageId };
    } catch (err) {
      logger.error('[NOTIFICATION] Error enviando push', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export default new FirebasePushProvider();
