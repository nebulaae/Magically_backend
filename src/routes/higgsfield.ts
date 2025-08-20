import express from 'express';
import * as higgsfieldController from '../controllers/higgsfieldController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';
import { uploadHiggsfieldImage } from '../middleware/upload';

const router = express.Router();

// Generate the video
router.post(
    '/generate',
    auth,
    uploadHiggsfieldImage,
    asyncHandler(higgsfieldController.generateHiggsfieldVideo)
);

// Process the video after user preview
router.post(
    '/process-video',
    auth,
    asyncHandler(higgsfieldController.processHiggsfieldVideo)
);

export default router;