import express from 'express';
import * as higgsfieldController from './controller/higgsfieldController';

import { auth } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { uploadHiggsfieldImage } from '../../shared/middleware/upload';
import { checkActiveGeneration } from '../publication/middleware/generationLimit';

const router = express.Router();

router.post(
  '/generate',
  auth,
  uploadHiggsfieldImage,
  checkActiveGeneration,
  asyncHandler(higgsfieldController.generateHiggsfieldVideo)
);

router.get('/motions', asyncHandler(higgsfieldController.getHiggsfieldMotions));

export default router;
