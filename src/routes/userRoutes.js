import { Router } from 'express';
import userController from '../controllers/UserController.js';
import clientProfileController from '../controllers/ClientProfileController.js';
import workerProfileController from '../controllers/WorkerProfileController.js';
import locationController from '../controllers/LocationController.js';
import chatController from '../controllers/ChatController.js';
import paymentController from '../controllers/PaymentController.js';
import { authenticateToken, requireRole } from '../middlewares/authMiddleware.js';

const router = Router();

// Rutas específicas de perfil de cliente (deben ir ANTES de /:id genérico)
router.get('/:id/client-profile', authenticateToken, clientProfileController.getProfile);
router.post('/:id/client-profile', authenticateToken, clientProfileController.createProfile);
router.patch('/:id/client-profile', authenticateToken, clientProfileController.updateProfile);

// Rutas específicas de perfil de trabajador
router.get(
  '/:id/worker-profile',
  authenticateToken,
  requireRole(['worker']),
  workerProfileController.getProfile,
);
router.post(
  '/:id/worker-profile',
  authenticateToken,
  requireRole(['worker']),
  workerProfileController.createProfile,
);
router.patch(
  '/:id/worker-profile',
  authenticateToken,
  requireRole(['worker']),
  workerProfileController.updateProfile,
);

// Ruta de cambio de rol (accesible por cualquier usuario autenticado con ambos perfiles)
router.post('/:id/switch-role', authenticateToken, userController.switchRole);

// Rutas de ubicaciones del usuario (deben ir ANTES de /:id genérico)
router.post('/:id/locations', authenticateToken, locationController.create);
router.get('/:id/locations', authenticateToken, locationController.list);

// Rutas de métodos de pago del usuario (deben ir ANTES de /:id genérico)
router.post('/:id/payment-methods', authenticateToken, paymentController.create);
router.get('/:id/payment-methods', authenticateToken, paymentController.list);

// Ruta de chats del usuario (debe ir ANTES de /:id genérico)
router.get('/:id/chats', authenticateToken, chatController.list);

// Rutas genéricas de usuario
router.get('/me', authenticateToken, userController.getMyProfile);
router.get('/:id', userController.getUserById);
router.patch('/:id', authenticateToken, userController.updateProfile);

export default router;
