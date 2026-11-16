import { Router } from 'express';
import categoryController from '../controllers/CategoryController.js';

const router = Router();

/**
 * @openapi
 * /categories:
 *   get:
 *     summary: Listar categorías activas de servicios
 *     description: Retorna la lista de categorías activas para selección en perfiles y filtros de búsqueda.
 *     tags:
 *       - Categorías
 *     responses:
 *       200:
 *         description: Lista de categorías obtenida exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       icon_url:
 *                         type: string
 *                         nullable: true
 */
router.get('/', (req, res, next) => categoryController.listActive(req, res, next));

export default router;
