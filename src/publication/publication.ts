import express from 'express';
import * as publicationController from './controller/publicationController';

import { auth } from '../../shared/middleware/auth';
import { optionalAuth } from '../../shared/middleware/optionalAuth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { uploadPublicationImage } from '../../shared/middleware/upload';

const router = express.Router();

// Get all publications (feed) - PUBLIC with optional auth
router.get(
  '/',
  optionalAuth,
  asyncHandler(publicationController.getAllPublications)
);

// Get current user's liked publications - REQUIRES AUTH
router.get(
  '/me/liked',
  auth,
  asyncHandler(publicationController.getMyLikedPublications)
);

// Create a new publication - REQUIRES AUTH
router.post(
  '/',
  auth,
  uploadPublicationImage,
  asyncHandler(publicationController.createPublication)
);

// Get a single publication by ID - PUBLIC with optional auth
router.get(
  '/:publicationId',
  optionalAuth,
  asyncHandler(publicationController.getPublicationById)
);

// Update a publication - REQUIRES AUTH
router.put(
  '/:publicationId',
  auth,
  asyncHandler(publicationController.updatePublication)
);

// DELETE a publication - REQUIRES AUTH
router.delete(
  '/:publicationId',
  auth,
  asyncHandler(publicationController.deletePublication)
);

// Like a publication - REQUIRES AUTH
router.post(
  '/:publicationId/like',
  auth,
  asyncHandler(publicationController.likePublication)
);

// Unlike a publication - REQUIRES AUTH
router.delete(
  '/:publicationId/unlike',
  auth,
  asyncHandler(publicationController.unlikePublication)
);

export default router;
