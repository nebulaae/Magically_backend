import { Request, Response } from 'express';
import * as galleryService from '../service/galleryService';
import * as apiResponse from '../../../shared/utils/apiResponse';
import logger from '../../../shared/utils/logger';

export const getMyGallery = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const {
      sortBy = 'newest',
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
      date
    );
    apiResponse.success(res, galleryItems);
  } catch (error) {
    logger.error(`Get gallery error: ${error.message}`);
    apiResponse.internalError(res, 'Server error while fetching gallery.');
  }
};

export const publishGalleryItem = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const galleryItemId = Array.isArray(req.params.galleryItemId)
      ? req.params.galleryItemId[0]
      : req.params.galleryItemId;

    const publication = await galleryService.publishFromGallery(
      galleryItemId,
      userId
    );
    apiResponse.success(res, publication, 'Published successfully', 201);
  } catch (error) {
    logger.error(`Publish from gallery error: ${error.message}`);
    if (error.message.includes('not found')) {
      return apiResponse.notFound(res, error.message);
    }
    if (error.message.includes('Access denied')) {
      return apiResponse.forbidden(res, error.message);
    }
    apiResponse.internalError(res, 'Server error while publishing.');
  }
};
