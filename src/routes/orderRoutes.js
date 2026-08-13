import { Router } from 'express';
import orderController from '../controllers/OrderController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/:id', authenticateToken, orderController.getById);
router.patch('/:id/status', authenticateToken, orderController.updateStatus);
router.get('/:id/history', authenticateToken, orderController.getHistory);

export default router;
