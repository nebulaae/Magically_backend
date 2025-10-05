import { Request, Response } from "express";
import * as galleryService from "../service/galleryService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import logger from "../../../shared/utils/logger";

export const getMyGallery = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const {
      sortBy = "newest",
      searchQuery,
      date,
    } = req.query as {
      sortBy?: string;
      searchQuery?: string;
      date?: string;
    };

    const galleryItems = await galleryService.getUserGallery(
      userId,
      sortBy,
      searchQuery,
      date,
    );
    apiResponse.success(res, galleryItems);
  } catch (error) {
    logger.error(`Get gallery error: ${error.message}`);
    apiResponse.internalError(res, "Server error while fetching gallery.");
  }
};
