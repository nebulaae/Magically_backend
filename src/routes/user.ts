import express from 'express';
import * as userController from '../controllers/userController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';
import { uploadAvatar } from '../middleware/upload';

const router = express.Router();

// Search for users
router.get('/search/users', auth, asyncHandler(userController.searchUsers));

// Get your own detailed profile
router.get('/me/profile', auth, asyncHandler(userController.getMe));

// Get your own followings
router.get('/me/profile/followers', auth, asyncHandler(userController.getMyFollowers))

// Get your own followers
router.get('/me/profile/following', auth, asyncHandler(userController.getMyFollowings))

// Update your profile
router.put('/me/profile', auth, asyncHandler(userController.updateProfile));

// Update your avatar
router.put('/me/avatar', auth, uploadAvatar, asyncHandler(userController.updateAvatar));

// Get a user's profile by username (must be after /me and /search routes)
router.get('/:username', auth, asyncHandler(userController.getProfile));

// Get a user's followers
router.get('/:username/followers', auth, asyncHandler(userController.getFollowers));

// Get a user's following
router.get('/:username/following', auth, asyncHandler(userController.getFollowing));

// Subscribe to (follow) a user by their ID
router.post('/:userId/subscribe', auth, asyncHandler(userController.subscribe));

// Unsubscribe from (unfollow) a user by their ID
router.delete('/:userId/unsubscribe', auth, asyncHandler(userController.unsubscribe));

export default router;