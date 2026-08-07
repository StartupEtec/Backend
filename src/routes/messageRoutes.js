import { Router } from 'express';
import messageController from '../controllers/MessageController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.delete('/:message_id', authenticateToken, messageController.remove);

export default router;
