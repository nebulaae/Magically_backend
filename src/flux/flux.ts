import express from "express";
import * as fluxController from "./controller/fluxController";
import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { checkActiveGeneration } from "../publication/middleware/generationLimit";

const router = express.Router();

router.post(
    "/generate",
    auth,
    checkActiveGeneration,
    asyncHandler(fluxController.generateImage),
);

export default router;