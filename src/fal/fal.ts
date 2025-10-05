import express from "express";
import * as falController from "./controller/falController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadFalImage } from "../../shared/middleware/upload";

const router = express.Router();

// Post-process an existing image. This now handles the file upload.
router.post(
  "/post-process",
  auth,
  uploadFalImage, // Middleware to handle the form-data image upload
  asyncHandler(falController.postProcessFalImage),
);

// Process the generated/processed image (publish or save)
router.post(
  "/process-image",
  auth,
  asyncHandler(falController.processFalImage),
);

export default router;
