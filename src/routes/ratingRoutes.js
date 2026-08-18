import { Router } from 'express';
import ratingController from '../controllers/RatingController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

// Crear calificación (POST /api/v1/ratings)
router.post('/ratings', authenticateToken, ratingController.create);

// Listar calificaciones recibidas por usuario (GET /api/v1/users/:id/ratings)
router.get('/users/:id/ratings', authenticateToken, ratingController.listByUser);

// Obtener promedio de calificaciones de usuario (GET /api/v1/users/:id/rating-average)
router.get('/users/:id/rating-average', authenticateToken, ratingController.getAverage);

export default router;
