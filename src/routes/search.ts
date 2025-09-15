import express from 'express';
import * as searchController from '../controllers/searchController';

import { auth } from '../middleware/auth';
import { asyncHandler } from '../lib/utils';

const router = express.Router();

// Main search route
router.get('/', auth, asyncHandler(searchController.search));

export default router;