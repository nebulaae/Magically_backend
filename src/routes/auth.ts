import express from 'express';
import * as authController from '../controllers/authController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';

const router = express.Router();

// Multi-step registration routes
router.post('/register-step-1', asyncHandler(authController.registerStep1));
router.post('/register-step-2', asyncHandler(authController.registerStep2));
router.post('/register-step-3', asyncHandler(authController.registerStep3));

// Login user
router.post('/login', asyncHandler(authController.login));

// Logout user
router.post('/logout', asyncHandler(authController.logout));

// Get current authenticated user
router.get('/me', auth, asyncHandler(authController.getMe));

// Password Management
router.post('/forgot-password', asyncHandler(authController.forgotPassword));
router.post('/reset-password/:token', asyncHandler(authController.resetPassword));


export default router;