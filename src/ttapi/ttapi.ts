import express from "express";
import * as ttapiController from "./controller/ttapiController";
import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadTtapiModelImages } from "../../shared/middleware/upload";
import { checkActiveGeneration } from "../publication/middleware/generationLimit";

const router = express.Router();

// Models CRUD
router.get("/models", auth, asyncHandler(ttapiController.getModels));
router.get("/models/:modelId", auth, asyncHandler(ttapiController.getModel));
router.post("/models", auth, uploadTtapiModelImages, asyncHandler(ttapiController.createModel));
router.put("/models/:modelId", auth, uploadTtapiModelImages, asyncHandler(ttapiController.updateModel));
router.delete("/models/:modelId", auth, asyncHandler(ttapiController.deleteModel));

// Generation
router.post(
    "/generate",
    auth,
    checkActiveGeneration,
    asyncHandler(ttapiController.generate)
);

export default router;