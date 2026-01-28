import express from 'express';
import * as galleryController from './controller/galleryController';

import { auth } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';

const router = express.Router();

router.get('/', auth, asyncHandler(galleryController.getMyGallery));

router.post(
  '/:galleryItemId/publish',
  auth,
  asyncHandler(galleryController.publishGalleryItem)
);

export default router;
