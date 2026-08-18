import { Router } from 'express';
import disputeController from '../controllers/DisputeController.js';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Abrir disputa (POST /api/v1/disputes)
router.post('/', authenticateToken, disputeController.create);

// Listar disputas (GET /api/v1/disputes)
router.get('/', authenticateToken, disputeController.list);

// Resolver/cerrar disputa (PATCH /api/v1/disputes/:id) - Solo admin
router.patch('/:id', authenticateToken, requireRole(['admin']), disputeController.resolve);

export default router;
