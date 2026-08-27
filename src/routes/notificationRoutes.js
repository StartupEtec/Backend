import { Router } from 'express';
import notificationController from '../controllers/NotificationController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

/**
 * @openapi
 * /api/v1/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Listar notificaciones del usuario
 *     description: Retorna las notificaciones del usuario autenticado con paginación y filtros opcionales.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Cantidad máxima de resultados por página.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Desplazamiento para paginación.
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, SENT, FAILED, READ]
 *         description: Filtrar por estado de la notificación.
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SERVICE_REQUEST, QUOTE_RECEIVED, QUOTE_ACCEPTED, SERVICE_COMPLETED, NEW_MESSAGE, ORDER_STATUS_CHANGE]
 *         description: Filtrar por tipo de notificación.
 *     responses:
 *       200:
 *         description: Lista de notificaciones.
 *       401:
 *         description: Token de autenticación faltante o inválido.
 */
router.get('/', (req, res, next) => notificationController.listNotifications(req, res, next));

/**
 * @openapi
 * /api/v1/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Obtener conteo de notificaciones no leídas
 *     description: Retorna la cantidad de notificaciones que el usuario no ha leído.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conteo de no leídas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 unread_count:
 *                   type: integer
 */
router.get('/unread-count', (req, res, next) =>
  notificationController.getUnreadCount(req, res, next),
);

/**
 * @openapi
 * /api/v1/notifications/{id}/read:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marcar notificación como leída
 *     description: Marca una notificación específica como leída.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID de la notificación.
 *     responses:
 *       200:
 *         description: Notificación marcada como leída.
 *       404:
 *         description: Notificación no encontrada.
 */
router.patch('/:id/read', (req, res, next) => notificationController.markAsRead(req, res, next));

/**
 * @openapi
 * /api/v1/notifications/read-all:
 *   patch:
 *     tags: [Notifications]
 *     summary: Marcar todas las notificaciones como leídas
 *     description: Marca todas las notificaciones no leídas del usuario como leídas.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cantidad de notificaciones marcadas.
 */
router.patch('/read-all', (req, res, next) => notificationController.markAllAsRead(req, res, next));

/**
 * @openapi
 * /api/v1/notifications/preferences:
 *   get:
 *     tags: [Notifications]
 *     summary: Obtener preferencias de notificación
 *     description: Retorna las preferencias de notificación del usuario autenticado.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferencias de notificación.
 */
router.get('/preferences', (req, res, next) =>
  notificationController.getPreferences(req, res, next),
);

/**
 * @openapi
 * /api/v1/notifications/preferences:
 *   patch:
 *     tags: [Notifications]
 *     summary: Actualizar preferencias de notificación
 *     description: Actualiza las preferencias de notificación del usuario autenticado.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               push_enabled:
 *                 type: boolean
 *               email_enabled:
 *                 type: boolean
 *               sms_enabled:
 *                 type: boolean
 *               dnd_enabled:
 *                 type: boolean
 *               dnd_start:
 *                 type: string
 *                 pattern: '^[0-2][0-9]:[0-5][0-9]$'
 *                 example: '22:00'
 *               dnd_end:
 *                 type: string
 *                 pattern: '^[0-2][0-9]:[0-5][0-9]$'
 *                 example: '08:00'
 *     responses:
 *       200:
 *         description: Preferencias actualizadas.
 *       400:
 *         description: Error de validación.
 */
router.patch('/preferences', (req, res, next) =>
  notificationController.updatePreferences(req, res, next),
);

/**
 * @openapi
 * /api/v1/notifications/test:
 *   post:
 *     tags: [Notifications]
 *     summary: Enviar notificación de prueba
 *     description: Envía una notificación de prueba al usuario autenticado. Solo disponible en desarrollo.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [SERVICE_REQUEST, QUOTE_RECEIVED, QUOTE_ACCEPTED, SERVICE_COMPLETED, NEW_MESSAGE, ORDER_STATUS_CHANGE]
 *                 default: ORDER_STATUS_CHANGE
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [push, email, sms]
 *     responses:
 *       201:
 *         description: Notificación de prueba enviada.
 *       403:
 *         description: No disponible en producción.
 */
router.post('/test', (req, res, next) =>
  notificationController.sendTestNotification(req, res, next),
);

export default router;
