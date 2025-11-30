import express from "express";
import swaggerUi from "swagger-ui-express";

import gptRoutes from "./gpt/gpt";
import nanoRoutes from "./nano/nano";
import authRoutes from "./auth/auth";
import userRoutes from "./user/user";
import adminRoutes from "./admin/admin";
import klingRoutes from "./kling/kling";
import searchRoutes from "./search/search";
import galleryRoutes from "./gallery/gallery";
import commentRoutes from "./comment/comment";
import replicateRoutes from "./replicate/replicate";
import higgsfieldRoutes from "./higgsfield/higgsfield";
import publicationRoutes from "./publication/publication";

import { swaggerDefinition } from "./swagger";

const router = express.Router();

// Check Health
router.get("/health", (req, res) => {
  res.json("Health is OK");
});

// API Documentation Route
router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDefinition));

// Functional Routes
router.use("/gpt", gptRoutes);
router.use("/nano", nanoRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/kling", klingRoutes);
router.use("/search", searchRoutes);
router.use("/gallery", galleryRoutes);
router.use("/comments", commentRoutes);
router.use("/replicate", replicateRoutes);
router.use("/higgsfield", higgsfieldRoutes);
router.use("/publications", publicationRoutes);

export default router;