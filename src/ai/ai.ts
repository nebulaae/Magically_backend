import express from "express";
import * as aiController from "./controller/aiController";
import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { checkActiveGeneration } from "../publication/middleware/generationLimit";
import { uploadAIModelImages } from "../../shared/middleware/upload";

const router = express.Router();

// ============ CRUD для моделей ============
router.get("/models", auth, asyncHandler(aiController.getModels));
router.get("/models/:modelId", auth, asyncHandler(aiController.getModel));
router.post("/models", auth, uploadAIModelImages, asyncHandler(aiController.createModel));
router.put("/models/:modelId", auth, uploadAIModelImages, asyncHandler(aiController.updateModel));
router.delete("/models/:modelId", auth, asyncHandler(aiController.deleteModel));

// ============ Генерация ============
router.post(
    "/generate",
    auth,
    checkActiveGeneration,
    asyncHandler(aiController.generateImage)
);

export default router;