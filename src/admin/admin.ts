import express from 'express';

import * as adminController from './controller/adminController';
import * as settingController from './controller/settingController';
import * as planAdminController from './controller/planController';

import { adminAuth } from '../../shared/middleware/adminAuth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { uploadTrendImages } from '../../shared/middleware/upload';

const router = express.Router();

router.post('/login', asyncHandler(adminController.login));
router.post('/logout', asyncHandler(adminController.logout));

// All routes below are protected and require admin role
router.use(adminAuth);

router.get('/users', asyncHandler(adminController.getAllUsers));
router.put('/users/:userId/block', asyncHandler(adminController.blockUser));
router.put('/users/:userId/unblock', asyncHandler(adminController.unblockUser));
router.delete(
  '/publications/:publicationId',
  asyncHandler(adminController.deletePublication)
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

// Планы
router.get('/plans', asyncHandler(planAdminController.listPlans));
router.post('/plans', asyncHandler(planAdminController.createPlan));
router.put('/plans/:planId', asyncHandler(planAdminController.updatePlan));
router.delete(
  '/plans/:planId',
  asyncHandler(planAdminController.deactivatePlan)
);

// Статистика
router.get(
  '/statistics/tariffs',
  asyncHandler(adminController.getTariffStatistics)
);

// Публикации (Модерация)
router.get('/publications', asyncHandler(adminController.listAllPublications));
router.delete(
  '/publications/:id',
  asyncHandler(adminController.deletePublication)
);

// Тренды (с загрузкой файлов)
router.get('/trends', asyncHandler(adminController.listTrends));
router.get('/trends/:id', asyncHandler(adminController.getTrend));
router.post(
  '/trends',
  uploadTrendImages,
  asyncHandler(adminController.createTrend)
);
router.put(
  '/trends/:id',
  uploadTrendImages,
  asyncHandler(adminController.updateTrend)
);
router.delete('/trends/:id', asyncHandler(adminController.deleteTrend));

export default router;
