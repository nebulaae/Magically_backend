import express from 'express';

import * as adminController from './controller/adminController';
import * as settingController from './controller/settingController';

import { auth } from '../../shared/middleware/auth';
import { adminAuth } from '../../shared/middleware/adminAuth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = express.Router();

router.post('/login', asyncHandler(adminController.login));
router.post('/logout', asyncHandler(adminController.logout));

// All routes below are protected and require admin role
router.use(auth, adminAuth);

router.get('/users', asyncHandler(adminController.getAllUsers));
router.put('/users/:userId/block', asyncHandler(adminController.blockUser));
router.put('/users/:userId/unblock', asyncHandler(adminController.unblockUser));
router.delete(
  '/publications/:publicationId',
  asyncHandler(adminController.deletePublication)
);
router.put(
  '/publications/:publicationId/photo-of-the-day',
  asyncHandler(adminController.setPhotoOfTheDay)
);
router.post('/users/:userId/tokens', asyncHandler(adminController.giveTokens));
router.delete(
  '/comments/:commentId',
  asyncHandler(adminController.deleteUserComment)
);
router.get('/analytics', asyncHandler(adminController.getAnalytics));

router.get('/settings', asyncHandler(settingController.getSettings));
router.put('/settings', asyncHandler(settingController.updateSettings));

export default router;