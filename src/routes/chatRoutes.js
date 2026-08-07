import { Router } from 'express';
import chatController from '../controllers/ChatController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/', authenticateToken, chatController.create);
router.get('/:chat_id', authenticateToken, chatController.getById);
router.delete('/:chat_id', authenticateToken, chatController.remove);

export default router;
