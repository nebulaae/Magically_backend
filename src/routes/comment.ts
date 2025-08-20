import express from "express";
import * as commentController from '../controllers/commentController';

import { auth } from '../middleware/auth';
import { asyncHandler } from "../lib/utils";

const router = express.Router();

// Create a comment
router.post('/:publicationId/comments', auth, asyncHandler(commentController.createComment));

// Get all comments for a publication (can be used for a separate comments page/section)
router.get('/:publicationId/comments', auth, asyncHandler(commentController.getCommentsForPublication));

// Reply to an existing comment
router.post('/:commentId/reply', auth, asyncHandler(commentController.replyToComment));

// Update a comment
router.put('/:commentId', auth, asyncHandler(commentController.updateComment));

// Delete a comment
router.delete('/:commentId', auth, asyncHandler(commentController.deleteComment));

// Like a comment
router.post('/:commentId/like', auth, asyncHandler(commentController.likeComment));

// Unlike a comment
router.delete('/:commentId/unlike', auth, asyncHandler(commentController.unlikeComment));

export default router;