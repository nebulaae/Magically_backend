import express from 'express';

import * as adminController from './controller/adminController';
import * as settingController from './controller/settingController';
import * as planAdminController from './controller/planController';

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
router.get(
  '/settings/tariffs',
  asyncHandler(settingController.getTariffSettings)
);
router.put(
  '/settings/tariffs',
  asyncHandler(settingController.updateTariffSettings)
);
router.get('/plans', asyncHandler(planAdminController.listPlans));
router.post('/plans', asyncHandler(planAdminController.createPlan));
router.put('/plans/:planId', asyncHandler(planAdminController.updatePlan));
router.delete('/plans/:planId', asyncHandler(planAdminController.deactivatePlan));
router.get(
  '/statistics/tariffs',
  asyncHandler(adminController.getTariffStatistics)
);

export default router;