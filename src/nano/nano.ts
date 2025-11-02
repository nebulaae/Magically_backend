import express from "express";
import * as nanoController from "./controller/nanoController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
// Not adding multer, as the API doc shows `image_urls` not file uploads

const router = express.Router();

router.post("/generate", auth, asyncHandler(nanoController.generateImage));

export default router;