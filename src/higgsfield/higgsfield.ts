import express from "express";
import * as higgsfieldController from "./controller/higgsfieldController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadHiggsfieldImage } from "../../shared/middleware/upload";

const router = express.Router();

// Generate the video
router.post(
  "/generate",
  auth,
  uploadHiggsfieldImage,
  asyncHandler(higgsfieldController.generateHiggsfieldVideo),
);

// Process the video after user preview
router.post(
  "/process-video",
  auth,
  asyncHandler(higgsfieldController.processHiggsfieldVideo),
);

export default router;
