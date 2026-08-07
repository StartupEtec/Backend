import { Router } from 'express';
import chatController from '../controllers/ChatController.js';
import messageController from '../controllers/MessageController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { uploadMessageImage, handleUploadError } from '../middlewares/upload.js';

const router = Router();

router.post('/', authenticateToken, chatController.create);
router.get('/:chat_id', authenticateToken, chatController.getById);
router.delete('/:chat_id', authenticateToken, chatController.remove);

// Mensajes del chat
router.post(
  '/:chat_id/messages',
  authenticateToken,
  uploadMessageImage.single('file'),
  handleUploadError,
  messageController.create,
);
router.get('/:chat_id/messages', authenticateToken, messageController.list);

export default router;
