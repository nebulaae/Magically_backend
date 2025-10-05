import express from "express";
import * as gptController from "./controller/gptController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = express.Router();

// Generate the image
router.post("/generate", auth, asyncHandler(gptController.generateImage));

// Process the generated image
router.post("/process-image", auth, asyncHandler(gptController.processImage));

export default router;
