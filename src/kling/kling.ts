import express from "express";
import * as klingController from "./controller/klingController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadKlingImage } from "../../shared/middleware/upload";

const router = express.Router();

// Generate the video
router.post(
  "/generate",
  auth,
  uploadKlingImage,
  asyncHandler(klingController.generateVideo),
);


export default router;