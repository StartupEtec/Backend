import { Router } from 'express';
import workerAvailabilityController from '../controllers/WorkerAvailabilityController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Disponibilidad del Trabajador
 *   description: Configuración de la disponibilidad horaria semanal de los trabajadores (día de la semana y rangos de horas en los que pueden recibir solicitudes)
 */

/**
 * @openapi
 * /workers/{id}/availability:
 *   post:
 *     summary: Crear un rango de disponibilidad
 *     description: Crea un rango horario de disponibilidad semanal para el perfil de trabajador. Solo el propietario del perfil puede hacerlo. Máximo 2 rangos por día de la semana.
 *     tags: [Disponibilidad del Trabajador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del perfil de trabajador
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [day_of_week, start_time, end_time]
 *             properties:
 *               day_of_week:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 example: 1
 *                 description: Día de la semana, 0 (Domingo) a 6 (Sábado)
 *               start_time:
 *                 type: string
 *                 pattern: '^([01]\d|2[0-3]):[0-5]\d$'
 *                 example: '09:00'
 *                 description: Hora de inicio del rango en formato 24h (HH:mm)
 *               end_time:
 *                 type: string
 *                 pattern: '^([01]\d|2[0-3]):[0-5]\d$'
 *                 example: '13:00'
 *                 description: Hora de fin del rango en formato 24h (HH:mm). Debe ser posterior a start_time
 *     responses:
 *       201:
 *         description: Rango de disponibilidad creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Disponibilidad creada correctamente
 *                 availability:
 *                   $ref: '#/components/schemas/WorkerAvailability'
 *       400:
 *         description: Error de validación (formato, rango invertido o DAY_OF_WEEK fuera de 0-6)
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Perfil de trabajador no encontrado o no autorizado
 *       409:
 *         description: Se alcanzó el máximo de 2 rangos para el día
 *       500:
 *         description: Error interno del servidor
 *
 *   get:
 *     summary: Listar disponibilidad de un trabajador
 *     description: Devuelve todos los rangos de disponibilidad semanal del perfil de trabajador ordenados por día y hora de inicio. Solo el propietario puede consultarlos.
 *     tags: [Disponibilidad del Trabajador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del perfil de trabajador
 *     responses:
 *       200:
 *         description: Lista de rangos de disponibilidad devuelta exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 availability:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WorkerAvailability'
 *                 count:
 *                   type: integer
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Perfil de trabajador no encontrado o no autorizado
 *       500:
 *         description: Error interno del servidor
 */

/**
 * @openapi
 * /availability/{id}:
 *   patch:
 *     summary: Actualizar un rango de disponibilidad
 *     description: Actualiza el día o el rango horario de una disponibilidad existente. Solo el propietario del perfil de trabajador asociado puede hacerlo.
 *     tags: [Disponibilidad del Trabajador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del rango de disponibilidad
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               day_of_week:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 6
 *                 example: 2
 *                 description: Día de la semana, 0 (Domingo) a 6 (Sábado)
 *               start_time:
 *                 type: string
 *                 pattern: '^([01]\d|2[0-3]):[0-5]\d$'
 *                 example: '10:00'
 *               end_time:
 *                 type: string
 *                 pattern: '^([01]\d|2[0-3]):[0-5]\d$'
 *                 example: '15:00'
 *     responses:
 *       200:
 *         description: Rango de disponibilidad actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Disponibilidad actualizada correctamente
 *                 availability:
 *                   $ref: '#/components/schemas/WorkerAvailability'
 *       400:
 *         description: Error de validación o rango horario invertido
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Disponibilidad no encontrada o no autorizado
 *       409:
 *         description: Se alcanzó el máximo de 2 rangos para el nuevo día
 *       500:
 *         description: Error interno del servidor
 *
 *   delete:
 *     summary: Eliminar un rango de disponibilidad
 *     description: Elimina un rango de disponibilidad existente. Solo el propietario del perfil de trabajador asociado puede hacerlo.
 *     tags: [Disponibilidad del Trabajador]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del rango de disponibilidad
 *     responses:
 *       200:
 *         description: Rango de disponibilidad eliminado correctamente
 *       401:
 *         description: No autenticado
 *       404:
 *         description: Disponibilidad no encontrada o no autorizado
 *       500:
 *         description: Error interno del servidor
 */

// Crear disponibilidad (POST /api/v1/workers/:id/availability)
router.post('/workers/:id/availability', authenticateToken, workerAvailabilityController.create);

// Listar disponibilidad (GET /api/v1/workers/:id/availability)
router.get('/workers/:id/availability', authenticateToken, workerAvailabilityController.list);

// Actualizar disponibilidad (PATCH /api/v1/availability/:id)
router.patch('/availability/:id', authenticateToken, workerAvailabilityController.update);

// Eliminar disponibilidad (DELETE /api/v1/availability/:id)
router.delete('/availability/:id', authenticateToken, workerAvailabilityController.remove);

export default router;
