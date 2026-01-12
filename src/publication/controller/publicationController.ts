import { Request, Response } from "express";
import * as publicationService from "../service/publicationService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import logger from "../../../shared/utils/logger";

export const getPublicationById = async (req: Request, res: Response) => {
  try {
    const { publicationId } = req.params as { publicationId: string };
    const userId = req.user?.id || null;
    const publication = await publicationService.getPublicationById(
      publicationId,
      userId,
    );
    apiResponse.success(res, publication);
  } catch (error) {
    logger.error(`Get publication by ID error: ${error.message}`);
    if (error.message.includes("not found")) {
      return apiResponse.notFound(res, error.message);
    }
    apiResponse.internalError(res, "Server error");
  }
};

export const getAllPublications = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id || null;
    const {
      page = "1",
      limit = "10",
      sortBy = "newest",
      hashtag = "",
    } = req.query as { [key: string]: string };
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    const result = await publicationService.getAllPublications(
      userId,
      pageNumber,
      limitNumber,
      sortBy,
      hashtag,
    );
    apiResponse.success(res, result);
  } catch (error) {
    logger.error(`Get all publications error: ${error.message}`);
    apiResponse.internalError(res, "Server error");
  }
};

export const createPublication = async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;
    const imageUrl = req.file
      ? `/publications/${req.file.filename}`
      : undefined;

    if (!content && !imageUrl) {
      return apiResponse.badRequest(
        res,
        "Publication must have content or an image.",
      );
    }
    const publication = await publicationService.createPublication(
      userId,
      content,
      imageUrl,
    );
    apiResponse.success(
      res,
      { publication },
      "Publication created successfully",
      201,
    );
  } catch (error) {
    logger.error(`Create publication error: ${error.message}`);
    apiResponse.internalError(res, "Server error during publication creation");
  }
};

export const updatePublication = async (req: Request, res: Response) => {
  try {
    const { publicationId } = req.params as { publicationId: string };
    const { content } = req.body;
    const userId = req.user.id;
    const publication = await publicationService.updatePublication(
      publicationId,
      userId,
      content,
    );
    apiResponse.success(
      res,
      { publication },
      "Publication updated successfully",
    );
  } catch (error) {
    logger.error(`Update publication error: ${error.message}`);
    if (error.message.includes("not found"))
      return apiResponse.notFound(res, error.message);
    if (error.message.includes("not authorized"))
      return apiResponse.forbidden(res, error.message);
    apiResponse.internalError(res, "Server error");
  }
};

export const deletePublication = async (req: Request, res: Response) => {
  try {
    const { publicationId } = req.params as { publicationId: string };
    const userId = req.user.id;
    const result = await publicationService.deletePublication(
      publicationId,
      userId,
    );
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Delete publication error: ${error.message}`);
    if (error.message.includes("not found"))
      return apiResponse.notFound(res, error.message);
    if (error.message.includes("not authorized"))
      return apiResponse.forbidden(res, error.message);
    apiResponse.internalError(res, "Server error while deleting publication.");
  }
};

export const likePublication = async (req: Request, res: Response) => {
  try {
    const { publicationId } = req.params as { publicationId: string };
    const userId = req.user.id;
    const result = await publicationService.likePublication(
      publicationId,
      userId,
    );
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Like publication error: ${error.message}`);
    if (error.name === "SequelizeUniqueConstraintError") {
      return apiResponse.conflict(
        res,
        "You have already liked this publication.",
      );
    }
    if (error.message.includes("not found"))
      return apiResponse.notFound(res, error.message);
    apiResponse.internalError(res, "Server error");
  }
};

export const unlikePublication = async (req: Request, res: Response) => {
  try {
    const { publicationId } = req.params as { publicationId: string };
    const userId = req.user.id;
    const result = await publicationService.unlikePublication(
      publicationId,
      userId,
    );
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Unlike publication error: ${error.message}`);
    if (error.message === "Not liked")
      return apiResponse.conflict(res, "You have not liked this publication.");
    if (error.message.includes("not found"))
      return apiResponse.notFound(res, error.message);
    apiResponse.internalError(res, "Server error");
  }
};

export const getMyLikedPublications = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const publications =
      await publicationService.getMyLikedPublications(userId);
    apiResponse.success(res, publications);
  } catch (error) {
    logger.error(`Get liked publications error: ${error.message}`);
    if (error.message.includes("not found"))
      return apiResponse.notFound(res, error.message);
    apiResponse.internalError(res, "Server error");
  }
};