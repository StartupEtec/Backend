import { Router } from 'express';
import disputeController from '../controllers/DisputeController.js';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Disputas
 *   description: Apertura, listado y resolución de disputas sobre órdenes COMPLETED o CANCELLED
 */

/**
 * @openapi
 * /disputes:
 *   post:
 *     summary: Abrir una disputa
 *     description: Permite al cliente o trabajador de una orden abrir una disputa. La orden debe estar en estado COMPLETED o CANCELLED y no debe existir otra disputa abierta para la misma orden.
 *     tags: [Disputas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_id, reason]
 *             properties:
 *               order_id:
 *                 type: string
 *                 format: uuid
 *                 description: UUID de la orden en estado COMPLETED o CANCELLED
 *                 example: c3d4e5f6-...
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *                 description: Motivo de la disputa
 *                 example: El servicio no se completó de acuerdo a lo acordado
 *               evidence_url:
 *                 type: string
 *                 format: uri
 *                 nullable: true
 *                 description: URL opcional de foto o documento de evidencia
 *     responses:
 *       201:
 *         description: Disputa creada correctamente en estado OPEN
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Disputa creada correctamente
 *                 dispute:
 *                   $ref: '#/components/schemas/Dispute'
 *       400:
 *         description: Error de validación o faltan participantes de la orden
 *       401:
 *         description: No autenticado
 *       403:
 *         description: El usuario no es participante de la orden
 *       404:
 *         description: Orden no encontrada
 *       409:
 *         description: La orden no está en COMPLETED/CANCELLED o ya existe una disputa
 *
 *   get:
 *     summary: Listar disputas
 *     description: Devuelve las disputas. Los usuarios ven únicamente las disputas donde participan (como cliente, trabajador o aperturante); los administradores ven todas. Soporta paginación.
 *     tags: [Disputas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Cantidad máxima de resultados
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Desplazamiento para paginación
 *     responses:
 *       200:
 *         description: Lista de disputas devuelta exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 disputes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Dispute'
 *                 count:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *       400:
 *         description: Parámetros de consulta inválidos
 *       401:
 *         description: No autenticado
 */

/**
 * @openapi
 * /disputes/{id}:
 *   patch:
 *     summary: Resolver o cerrar una disputa
 *     description: Acceso exclusivo de administrador. Cambia el estado de una disputa OPEN a RESOLVED o CLOSED. Si es RESOLVED, se requiere el campo `winner` para ejecutar la resolución financiera; a favor del cliente reembolsa los fondos (desde escrow o debitando del trabajador si ya fueron liberados); a favor del trabajador libera los fondos retenidos en escrow.
 *     tags: [Disputas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID de la disputa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status, resolution_notes]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [RESOLVED, CLOSED]
 *                 description: RESOLVED ejecuta la resolución financiera, CLOSED solo cierra la disputa
 *               resolution_notes:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *                 description: Notas que explican la resolución
 *               winner:
 *                 type: string
 *                 enum: [client, worker]
 *                 nullable: true
 *                 description: Requerido cuando status es RESOLVED. Indica a favor de quién se resuelve
 *     responses:
 *       200:
 *         description: Disputa resuelta/cerrada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Disputa resuelta/cerrada correctamente
 *                 dispute:
 *                   $ref: '#/components/schemas/Dispute'
 *       400:
 *         description: Error de validación
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Solo administradores pueden resolver disputas
 *       404:
 *         description: Disputa u orden asociada no encontrada
 *       409:
 *         description: La disputa no está en estado OPEN
 *       502:
 *         description: No se pudo reembolsar a la tarjeta del cliente
 */

// Abrir disputa (POST /api/v1/disputes)
router.post('/', authenticateToken, disputeController.create);

// Listar disputas (GET /api/v1/disputes)
router.get('/', authenticateToken, disputeController.list);

// Resolver/cerrar disputa (PATCH /api/v1/disputes/:id) - Solo admin
router.patch('/:id', authenticateToken, requireRole(['admin']), disputeController.resolve);

export default router;
