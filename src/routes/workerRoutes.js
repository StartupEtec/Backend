import { Router } from 'express';
import workerSearchController from '../controllers/WorkerSearchController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/nearby', authenticateToken, workerSearchController.nearby);

export default router;
