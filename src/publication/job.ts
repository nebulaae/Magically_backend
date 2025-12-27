import express from "express";
import * as jobController from "./controller/jobController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = express.Router();

router.get(
    "/active",
    auth,
    asyncHandler(jobController.getActiveGeneration)
);

router.get(
    "/history",
    auth,
    asyncHandler(jobController.getGenerationHistory)
);

router.get(
    "/jobs/:id",
    auth,
    asyncHandler(jobController.getGenerationById)
);

export default router;