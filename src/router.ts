import express from "express";
import swaggerUi from "swagger-ui-express";

import gptRoutes from "./gpt/gpt";
import nanoRoutes from "./nano/nano";
import authRoutes from "./auth/auth";
import userRoutes from "./user/user";
import adminRoutes from "./admin/admin";
import klingRoutes from "./kling/kling";
import ttapiRoutes from "./ttapi/ttapi";
import jobRoutes from "./publication/job";
import searchRoutes from "./search/search";
import galleryRoutes from "./gallery/gallery";
import commentRoutes from "./comment/comment";
import higgsfieldRoutes from "./higgsfield/higgsfield";
import publicationRoutes from "./publication/publication";
import transactionRoutes from "./transaction/transaction";

import { swaggerDefinition } from "./swagger";

const router = express.Router();

// Check Health
router.get("/health", (req, res) => {
  res.json("Health is OK");
});

// API Documentation Route
router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

// Functional Routes
router.use("/job", jobRoutes);
router.use("/gpt", gptRoutes);
router.use("/nano", nanoRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/kling", klingRoutes);
router.use("/ttapi", ttapiRoutes);
router.use("/search", searchRoutes);
router.use("/gallery", galleryRoutes);
router.use("/comments", commentRoutes);
router.use("/higgsfield", higgsfieldRoutes);
router.use("/transaction", transactionRoutes);
router.use("/publications", publicationRoutes);

export default router;