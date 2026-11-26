import { Router } from 'express';
import quoteRequestController from '../controllers/QuoteRequestController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

const listSent = (req, res, next) => {
  req.query = { ...req.query, role: 'MINE_AS_CLIENT' };
  return quoteRequestController.list(req, res, next);
};

const listReceived = (req, res, next) => {
  req.query = { ...req.query, role: 'MINE_AS_WORKER' };
  return quoteRequestController.list(req, res, next);
};

router.post('/request', authenticateToken, quoteRequestController.create);
router.post('/requests', authenticateToken, quoteRequestController.create);
router.get('/requests', authenticateToken, quoteRequestController.list);
router.get('/requests/sent', authenticateToken, listSent);
router.get('/requests/received', authenticateToken, listReceived);
router.get('/requests/:id', authenticateToken, quoteRequestController.getById);
router.post('/requests/:id/quotes', authenticateToken, quoteRequestController.createQuote);
router.patch('/requests/:id/status', authenticateToken, quoteRequestController.updateStatus);
router.delete('/requests/:id', authenticateToken, quoteRequestController.remove);

router.get('/:id', authenticateToken, quoteRequestController.getById);
router.post('/:id/quotes', authenticateToken, quoteRequestController.createQuote);
router.patch('/:id/status', authenticateToken, quoteRequestController.updateStatus);
router.delete('/:id', authenticateToken, quoteRequestController.remove);

export default router;
