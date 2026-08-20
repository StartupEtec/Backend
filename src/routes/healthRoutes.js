import { Router } from 'express';
import path from 'node:path';
import healthService from '../services/HealthService.js';

const router = Router();

/**
 * @openapi
 * tags:
 *   name: Health & Monitoreo
 *   description: Endpoints de diagnóstico de salud del sistema, APM y dashboard visual
 */

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Diagnóstico básico de salud del sistema
 *     description: Retorna el estado global simplificado de la API, base de datos y caché.
 *     tags: [Health & Monitoreo]
 *     responses:
 *       200:
 *         description: El sistema está operativo o parcialmente degradado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: UP
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                   properties:
 *                     api:
 *                       type: string
 *                       example: UP
 *                     database:
 *                       type: string
 *                       example: UP
 *                     cache:
 *                       type: string
 *                       example: UP
 */
router.get('/health', async (req, res, next) => {
  try {
    const health = await healthService.getBasicHealth();
    const status = health.status === 'UP' ? 200 : 503;
    res.status(status).json(health);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /health/detailed:
 *   get:
 *     summary: Diagnóstico detallado del sistema y APM
 *     description: Retorna información profunda sobre latencias de BD/Caché, uptime del proceso y métricas agregadas del APM interno (errores 5xx, latencia promedio y percentil 95).
 *     tags: [Health & Monitoreo]
 *     responses:
 *       200:
 *         description: Diagnóstico profundo devuelto exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/health/detailed', async (req, res, next) => {
  try {
    const detailed = await healthService.getDetailedHealth();
    const status = detailed.status === 'UP' ? 200 : 503;
    res.status(status).json(detailed);
  } catch (err) {
    next(err);
  }
});

/**
 * @openapi
 * /health/dashboard:
 *   get:
 *     summary: Acceso al Dashboard de Monitoreo Visual
 *     description: Sirve la página web interactiva con gráficas de latencia y estado de componentes en tiempo real.
 *     tags: [Health & Monitoreo]
 *     responses:
 *       200:
 *         description: Dashboard visual retornado correctamente
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
router.get('/health/dashboard', (req, res) => {
  const filePath = path.resolve('src/utils/dashboard.html');
  res.sendFile(filePath);
});

export default router;
