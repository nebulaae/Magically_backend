import express from "express";
import * as searchController from "./controller/searchController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = express.Router();

// Main search route
router.get("/", auth, asyncHandler(searchController.search));

export default router;
