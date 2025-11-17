import path from "path";
import YAML from "yamljs";
import express from "express";
import swaggerUi from "swagger-ui-express";

import gptRoutes from "./gpt/gpt";
import nanoRoutes from "./nano/nano";
import authRoutes from "./auth/auth";
import userRoutes from "./user/user";
import adminRoutes from "./admin/admin";
import klingRoutes from "./kling/kling";
import searchRoutes from "./search/search";
import historyRoutes from "./history/history";
import galleryRoutes from "./gallery/gallery";
import commentRoutes from "./comment/comment";
import replicateRoutes from "./replicate/replicate";
import higgsfieldRoutes from "./higgsfield/higgsfield";
import publicationRoutes from "./publication/publication";

const router = express.Router();
const swaggerSpec = YAML.load(path.join(__dirname, "../swagger.yaml"));

// Check Health
router.get("/health", (req, res) => {
  res.json("Health is OK");
});

// API Documentation Route
router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Functional Routes
router.use("/gpt", gptRoutes);
router.use("/nano", nanoRoutes);
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/admin", adminRoutes);
router.use("/kling", klingRoutes);
router.use("/search", searchRoutes);
router.use("/history", historyRoutes);
router.use("/gallery", galleryRoutes);
router.use("/comments", commentRoutes);
router.use("/replicate", replicateRoutes);
router.use("/higgsfield", higgsfieldRoutes);
router.use("/publications", publicationRoutes);

export default router;