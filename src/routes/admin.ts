import express from 'express';
import * as adminController from '../controllers/adminController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';
import { adminAuth } from '../middleware/adminAuth';

const router = express.Router();

router.post('/login', asyncHandler(adminController.login));

// All routes below are protected and require admin role
router.use(auth, adminAuth);

router.get('/users', asyncHandler(adminController.getAllUsers));
router.put('/users/:userId/block', asyncHandler(adminController.blockUser));
router.put('/users/:userId/unblock', asyncHandler(adminController.unblockUser));
router.delete('/publications/:publicationId', asyncHandler(adminController.deletePublication));
router.put('/publications/:publicationId/photo-of-the-day', asyncHandler(adminController.setPhotoOfTheDay));

export default router;