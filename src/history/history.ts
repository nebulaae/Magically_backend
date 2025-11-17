import express from "express";
import * as historyController from "./controller/historyController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = express.Router();

router.get("/", auth, asyncHandler(historyController.getMyHistory));

router.get("/:historyId", auth, asyncHandler(historyController.getHistoryById));

export default router;