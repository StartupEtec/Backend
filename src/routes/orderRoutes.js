import { Router } from 'express';
import orderController from '../controllers/OrderController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Rutas de órdenes (prefijo /api/v1/orders)
router.post('/', authenticateToken, orderController.create);
router.get('/users/:id/orders', authenticateToken, orderController.listUserOrders);
router.get('/:id', authenticateToken, orderController.getById);
router.patch('/:id/status', authenticateToken, orderController.updateStatus);
router.get('/:id/history', authenticateToken, orderController.getHistory);
router.post('/:id/complete', authenticateToken, orderController.complete);

export default router;
