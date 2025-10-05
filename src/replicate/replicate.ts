import express from "express";
import * as replicateController from "./controller/replicateController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadReplicateImages } from "../../shared/middleware/upload";

const router = express.Router();

// Train a new model
router.post(
  "/train",
  auth,
  uploadReplicateImages,
  asyncHandler(replicateController.trainModel),
);

// Generate an image from a trained model
router.post("/generate", auth, asyncHandler(replicateController.generateImage));

export default router;
