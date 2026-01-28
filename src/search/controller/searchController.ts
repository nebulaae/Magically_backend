import { Request, Response } from 'express';
import logger from '../../../shared/utils/logger';
import * as searchService from '../service/searchService';
import * as apiResponse from '../../../shared/utils/apiResponse';

export const search = async (req: Request, res: Response) => {
  try {
    const {
      query,
      type = 'all',
      sortBy = 'newest',
      hashtag,
    } = req.query as { [key: string]: string };
    const currentUserId = req.user.id;

    if (!query && !hashtag) {
      return apiResponse.success(res, { users: [], publications: [] });
    }

    const results = await searchService.searchAll(
      query,
      type,
      sortBy,
      hashtag,
      currentUserId
    );
    apiResponse.success(res, results);
  } catch (error) {
    logger.error(`Search error: ${error.message}`);
    apiResponse.internalError(res, 'Server error during search.');
  }
};
