import { Router } from 'express';
import quoteController from '../controllers/QuoteController.js';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Cotizaciones de una orden (solo el trabajador asignado puede crear)
router.post(
  '/orders/:order_id/quotes',
  authenticateToken,
  requireRole(['worker']),
  quoteController.create,
);
router.get('/orders/:order_id/quotes', authenticateToken, quoteController.list);

// Detalle y gestión de una cotización
router.get('/quotes/:quote_id', authenticateToken, quoteController.getById);
router.patch('/quotes/:quote_id', authenticateToken, quoteController.updateStatus);
router.delete('/quotes/:quote_id', authenticateToken, quoteController.remove);

export default router;
