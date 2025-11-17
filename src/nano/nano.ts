import express from "express";
import * as nanoController from "./controller/nanoController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadNanoImages } from "../../shared/middleware/upload";

const router = express.Router();

router.post(
  "/generate",
  auth,
  uploadNanoImages,
  asyncHandler(nanoController.generateImage),
);

router.post("/process-image", auth, asyncHandler(nanoController.processImage));

export default router;