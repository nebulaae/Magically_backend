import express from 'express';
import * as klingController from '../controllers/klingController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';
import { uploadKlingImage } from '../middleware/upload';

const router = express.Router();

// Generate the video
router.post(
    '/generate',
    auth,
    uploadKlingImage,
    asyncHandler(klingController.generateAndPollKlingVideo)
);

// Process the generated video
router.post(
    '/process-video',
    auth,
    asyncHandler(klingController.processKlingVideo)
);

export default router;
