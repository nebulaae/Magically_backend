import express from 'express';
import * as falController from '../controllers/falController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';
import { uploadFalImage } from '../middleware/upload';

const router = express.Router();

// Post-process an existing image. This now handles the file upload.
router.post(
    '/post-process',
    auth,
    uploadFalImage, // Middleware to handle the form-data image upload
    asyncHandler(falController.postProcessFalImage)
);

// Process the generated/processed image (publish or save)
router.post(
    '/process-image',
    auth,
    asyncHandler(falController.processFalImage)
);

export default router;