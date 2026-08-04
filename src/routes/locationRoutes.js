import { Router } from 'express';
import locationController from '../controllers/LocationController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/:location_id', authenticateToken, locationController.getById);
router.patch('/:location_id', authenticateToken, locationController.update);
router.delete('/:location_id', authenticateToken, locationController.remove);

export default router;
