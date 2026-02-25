import express from 'express';
import { auth } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import * as plansController from './controller/plansController';

const router = express.Router();

router.get('/', asyncHandler(plansController.getPlans));
router.post('/purchase', auth, asyncHandler(plansController.purchasePackage));
router.post('/subscribe', auth, asyncHandler(plansController.subscribe));
router.post('/unsubscribe', auth, asyncHandler(plansController.unsubscribe));
router.post('/topup', auth, asyncHandler(plansController.topup));
router.post('/upgrade', auth, asyncHandler(plansController.upgrade));
router.get('/:id', asyncHandler(plansController.getPlanById));

export default router;
