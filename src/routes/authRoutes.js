import { Router } from 'express';
import authController from '../controllers/AuthController.js';
import { authFailRateLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Apply auth rate limiting to all auth endpoints
router.use(authFailRateLimiter);

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyOtp);
router.post('/refresh-token', authController.refreshToken);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-code', authController.verifyResetCode);
router.post('/reset-password', authController.resetPassword);

export default router;
