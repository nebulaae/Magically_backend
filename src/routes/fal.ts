import express from 'express';
import * as falController from '../controllers/falController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';
import { uploadFalImage } from '../middleware/upload';

const router = express.Router();

// Generate the image
router.post(
    '/generate',
    auth,
    uploadFalImage,
    asyncHandler(falController.generateFalImage)
);

// Process the generated image
router.post(
    '/process-image',
    auth,
    asyncHandler(falController.processFalImage)
);

export default router;