import express from 'express';
import * as gptController from '../controllers/gptController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';

const router = express.Router();

// Generate the image
router.post(
    '/generate',
    auth,
    asyncHandler(gptController.generateImage)
);

// Process the generated image
router.post(
    '/process-image',
    auth,
    asyncHandler(gptController.processImage)
);

export default router;