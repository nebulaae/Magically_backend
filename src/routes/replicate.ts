import express from 'express';
import * as replicateController from '../controllers/replicateController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';
import { uploadReplicateImages } from '../middleware/upload';

const router = express.Router();

// Train a new model
router.post('/train', auth, uploadReplicateImages, asyncHandler(replicateController.trainModel));

// Generate an image from a trained model
router.post('/generate', auth, asyncHandler(replicateController.generateImage));

export default router;