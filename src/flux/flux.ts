import express from "express";
import * as fluxController from "./controller/fluxController";
import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { checkActiveGeneration } from "../publication/middleware/generationLimit";
import { uploadFluxModelImages } from "../../shared/middleware/upload";

const router = express.Router();

// Models CRUD
router.get("/models", auth, asyncHandler(fluxController.getModels));
router.get("/models/:modelId", auth, asyncHandler(fluxController.getModel));
router.post("/models", auth, uploadFluxModelImages, asyncHandler(fluxController.createModel));
router.put("/models/:modelId", auth, uploadFluxModelImages, asyncHandler(fluxController.updateModel));
router.delete("/models/:modelId", auth, asyncHandler(fluxController.deleteModel));

// Generation
router.post(
    "/generate",
    auth,
    checkActiveGeneration,
    asyncHandler(fluxController.generateImage),
);

export default router;