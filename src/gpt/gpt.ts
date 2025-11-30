import express from "express";
import * as gptController from "./controller/gptController";
import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadGptImages } from "../../shared/middleware/upload";

const router = express.Router();

router.post(
    "/generate",
    auth,
    uploadGptImages,
    asyncHandler(gptController.generateImage),
);

export default router;