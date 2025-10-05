import express from "express";
import * as publicationController from "./controller/publicationController";

import { auth } from "../../shared/middleware/auth";
import { asyncHandler } from "../../shared/utils/asyncHandler";
import { uploadPublicationImage } from "../../shared/middleware/upload";

const router = express.Router();

// Get all publications (feed)
router.get("/", auth, asyncHandler(publicationController.getAllPublications));

// Get current user's liked publications
router.get(
  "/me/liked",
  auth,
  asyncHandler(publicationController.getMyLikedPublications),
);

// Create a new publication
router.post(
  "/",
  auth,
  uploadPublicationImage,
  asyncHandler(publicationController.createPublication),
);

// Get a single publication by ID
router.get(
  "/:publicationId",
  auth,
  asyncHandler(publicationController.getPublicationById),
);

// Update a publication
router.put(
  "/:publicationId",
  auth,
  asyncHandler(publicationController.updatePublication),
);

// DELETE a publication
router.delete(
  "/:publicationId",
  auth,
  asyncHandler(publicationController.deletePublication),
);

// Like a publication
router.post(
  "/:publicationId/like",
  auth,
  asyncHandler(publicationController.likePublication),
);

// Unlike a publication
router.delete(
  "/:publicationId/unlike",
  auth,
  asyncHandler(publicationController.unlikePublication),
);

export default router;
