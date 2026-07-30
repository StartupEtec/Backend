import { Router } from 'express';
import userController from '../controllers/UserController.js';
import clientProfileController from '../controllers/ClientProfileController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Rutas específicas de perfil de cliente (deben ir ANTES de /:id genérico)
router.get('/:id/client-profile', authenticateToken, clientProfileController.getProfile);
router.post('/:id/client-profile', authenticateToken, clientProfileController.createProfile);
router.patch('/:id/client-profile', authenticateToken, clientProfileController.updateProfile);

// Rutas genéricas de usuario
router.get('/me', authenticateToken, userController.getMyProfile);
router.get('/:id', userController.getUserById);
router.patch('/:id', authenticateToken, userController.updateProfile);

export default router;
