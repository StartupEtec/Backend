import { Router } from 'express';
import userController from '../controllers/UserController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/me', authenticateToken, userController.getMyProfile);
router.get('/:id', userController.getUserById);
router.patch('/:id', authenticateToken, userController.updateProfile);

export default router;
