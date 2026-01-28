import express from 'express';
import * as commentController from './controller/commentController';

import { auth } from '../../shared/middleware/auth';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { optionalAuth } from '../../shared/middleware/optionalAuth';

const router = express.Router();

// Create a comment - REQUIRES AUTH
router.post(
  '/:publicationId/comments',
  auth,
  asyncHandler(commentController.createComment)
);

// Get all comments for a publication - PUBLIC with optional auth
router.get(
  '/:publicationId/comments',
  optionalAuth,
  asyncHandler(commentController.getCommentsForPublication)
);

// Reply to an existing comment - REQUIRES AUTH
router.post(
  '/:commentId/reply',
  auth,
  asyncHandler(commentController.replyToComment)
);

// Update a comment - REQUIRES AUTH
router.put('/:commentId', auth, asyncHandler(commentController.updateComment));

// Delete a comment - REQUIRES AUTH
router.delete(
  '/:commentId',
  auth,
  asyncHandler(commentController.deleteComment)
);

// Like a comment - REQUIRES AUTH
router.post(
  '/:commentId/like',
  auth,
  asyncHandler(commentController.likeComment)
);

// Unlike a comment - REQUIRES AUTH
router.delete(
  '/:commentId/unlike',
  auth,
  asyncHandler(commentController.unlikeComment)
);

export default router;
