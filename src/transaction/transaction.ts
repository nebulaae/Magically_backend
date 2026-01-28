import express from 'express';

import { auth } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

import * as transactionController from './controller/transactionController';

const router = express.Router();

router.get('/', auth, asyncHandler(transactionController.getMyTransactions));

export default router;
