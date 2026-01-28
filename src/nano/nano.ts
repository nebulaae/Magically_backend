import express from 'express';
import * as nanoController from './controller/nanoController';

import { auth } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { uploadNanoImages } from '../../shared/middleware/upload';
import { checkActiveGeneration } from '../publication/middleware/generationLimit';

const router = express.Router();

router.post(
  '/generate',
  auth,
  checkActiveGeneration,
  uploadNanoImages,
  asyncHandler(nanoController.generateImage)
);

export default router;
