import express from 'express';
import * as galleryController from '../controllers/galleryController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';

const router = express.Router();

// Get all items from the current user's private gallery
router.get('/', auth, asyncHandler(galleryController.getMyGallery));

export default router;