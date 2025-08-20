import express from "express";
import * as publicationController from '../controllers/publicationController';

import { auth } from '../middleware/auth';
import { asyncHandler } from "../lib/utils";
import { uploadPublicationImage } from '../middleware/upload';

const router = express.Router();

// Get all publications (feed)
router.get('/', auth, asyncHandler(publicationController.getAllPublications));

// Get current user's liked publications
router.get('/me/liked', auth, asyncHandler(publicationController.getMyLikedPublications));

// Create a new publication
router.post('/', auth, uploadPublicationImage, asyncHandler(publicationController.createPublication));

// Get a single publication by ID
router.get('/:publicationId', auth, asyncHandler(publicationController.getPublicationById));

// Update a publication
router.put('/:publicationId', auth, asyncHandler(publicationController.updatePublication));

// Like a publication
router.post('/:publicationId/like', auth, asyncHandler(publicationController.likePublication));

// Unlike a publication
router.delete('/:publicationId/unlike', auth, asyncHandler(publicationController.unlikePublication));

export default router;