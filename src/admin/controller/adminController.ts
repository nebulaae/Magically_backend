import logger from '../../../shared/utils/logger';
import { Request, Response } from 'express';
import { Publication } from '../../publication/models/Publication';
import { User } from '../../user/models/User';
import { Trend } from '../models/Trend';
import {
  deleteFile,
  deleteFiles,
  handleFilesUpload,
  handleFileUpload,
} from '../../../shared/middleware/upload';
import * as adminService from '../service/adminService';
import * as apiResponse from '../../../shared/utils/apiResponse';

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const result = await adminService.loginAdmin(username, password);

  if (!result) {
    return apiResponse.unauthorized(res, 'Invalid credentials');
  }

  res.cookie('admin_token', result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });

  apiResponse.success(res, result, 'Admin logged in successfully');
};

export const logout = async (req: Request, res: Response) => {
  res.clearCookie('admin_token');
  apiResponse.success(res, null, 'Logged out successfully');
};

export const getAllUsers = async (req: Request, res: Response) => {
  const users = await adminService.getAllUsers();
  apiResponse.success(res, users);
};

export const blockUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await adminService.blockUser(
    Array.isArray(userId) ? userId[0] : userId
  );

  if (!user) {
    return apiResponse.notFound(res, 'User not found');
  }

  apiResponse.success(res, null, `${user.username} has been blocked`);
};

export const unblockUser = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const user = await adminService.unblockUser(
    Array.isArray(userId) ? userId[0] : userId
  );

  if (!user) {
    return apiResponse.notFound(res, 'User not found');
  }

  apiResponse.success(res, null, `${user.username} has been unblocked`);
};

export const deletePublication = async (req: Request, res: Response) => {
  const { publicationId } = req.params;
  const result = await adminService.deletePublication(
    Array.isArray(publicationId) ? publicationId[0] : publicationId
  );

  if (!result) {
    return apiResponse.notFound(res, 'Publication not found');
  }

  apiResponse.success(res, null, 'Publication was deleted successfully');
};

// Модерация всех публикаций
export const listAllPublications = async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const publications = await Publication.findAndCountAll({
    include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']],
    limit: Number(limit),
    offset,
  });
  apiResponse.success(res, publications);
};

export const listTrends = async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  const trends = await Trend.findAndCountAll({
    order: [['createdAt', 'DESC']],
    limit: Number(limit),
    offset,
  });

  apiResponse.success(res, {
    trends: trends.rows,
    total: trends.count,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(trends.count / Number(limit)),
  });
};

export const getTrend = async (req: Request, res: Response) => {
  const { id } = req.params;
  const trend = await Trend.findByPk(Array.isArray(id) ? id[0] : id);
  if (!trend) return apiResponse.notFound(res, 'Trend not found');
  apiResponse.success(res, trend);
};

export const createTrend = async (req: Request, res: Response) => {
  const { content, coverText } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  let trendingCoverUrl: string | undefined;
  let trendingImageSetUrls: string[] = [];

  if (files?.trendingCover?.[0]) {
    trendingCoverUrl = await handleFileUpload(
      files.trendingCover[0],
      'publications/trends'
    );
  }

  if (files?.trendingImageSet?.length) {
    trendingImageSetUrls = await handleFilesUpload(
      files.trendingImageSet,
      'publications/trends'
    );
  }

  const trend = await Trend.create({
    content,
    coverText,
    trendingCover: trendingCoverUrl,
    trendingImageSet:
      trendingImageSetUrls.length > 0 ? trendingImageSetUrls : [],
    adminId: req.user.id,
  });

  apiResponse.success(res, trend, 'Trend created');
};

export const updateTrend = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { content, coverText, removeImages } = req.body;
  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const trend = await Trend.findByPk(Array.isArray(id) ? id[0] : id);
  if (!trend) return apiResponse.notFound(res, 'Trend not found');

  let trendingCoverUrl = trend.trendingCover;
  let trendingImageSetUrls: string[] = trend.trendingImageSet || [];

  // Если прислали новую обложку
  if (files?.trendingCover?.[0]) {
    if (trendingCoverUrl) {
      await deleteFile(trendingCoverUrl).catch((e) =>
        logger.error(`Delete old cover error: ${e}`)
      );
    }
    trendingCoverUrl = await handleFileUpload(
      files.trendingCover[0],
      'publications/trends'
    );
  }

  // Если прислали новый набор изображений (полная замена)
  if (files?.trendingImageSet?.length) {
    if (trendingImageSetUrls.length > 0) {
      await deleteFiles(trendingImageSetUrls).catch((e) =>
        logger.error(`Delete old images error: ${e}`)
      );
    }
    trendingImageSetUrls = await handleFilesUpload(
      files.trendingImageSet,
      'publications/trends'
    );
  }

  // Удаление конкретных изображений из набора
  if (removeImages) {
    const toRemove: string[] = Array.isArray(removeImages)
      ? removeImages
      : [removeImages];
    await deleteFiles(toRemove).catch((e) =>
      logger.error(`Delete selected images error: ${e}`)
    );
    trendingImageSetUrls = trendingImageSetUrls.filter(
      (img) => !toRemove.includes(img)
    );
  }

  await trend.update({
    content: content !== undefined ? content : trend.content,
    coverText: coverText !== undefined ? coverText : trend.coverText,
    trendingCover: trendingCoverUrl,
    trendingImageSet: trendingImageSetUrls,
  });

  apiResponse.success(res, trend, 'Trend updated');
};

export const deleteTrend = async (req: Request, res: Response) => {
  const { id } = req.params;

  const trend = await Trend.findByPk(Array.isArray(id) ? id[0] : id);
  if (!trend) return apiResponse.notFound(res, 'Trend not found');

  if (trend.trendingCover) {
    await deleteFile(trend.trendingCover).catch(() => { });
  }
  if (trend.trendingImageSet && trend.trendingImageSet.length > 0) {
    await deleteFiles(trend.trendingImageSet).catch(() => { });
  }

  await trend.destroy();
  apiResponse.success(res, null, 'Trend deleted successfully');
};

export const giveTokens = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { amount, reason } = req.body;
  if (!amount || !reason)
    return apiResponse.badRequest(res, 'Amount and reason are required');

  await adminService.addTokensToUser(
    req.user.id,
    Array.isArray(userId) ? userId[0] : userId,
    Number(amount),
    reason
  );
  apiResponse.success(res, null, 'Tokens added successfully');
};

export const deleteUserComment = async (req: Request, res: Response) => {
  const { commentId } = req.params;
  await adminService.deleteComment(
    Array.isArray(commentId) ? commentId[0] : commentId
  );
  apiResponse.success(res, null, 'Comment deleted by admin');
};

export const getAnalytics = async (_req: Request, res: Response) => {
  const data = await adminService.getFullAnalytics();
  apiResponse.success(res, data);
};

export const getTariffStatistics = async (req: Request, res: Response) => {
  const fromRaw = Array.isArray(req.query.from)
    ? req.query.from[0]
    : req.query.from;
  const toRaw = Array.isArray(req.query.to) ? req.query.to[0] : req.query.to;

  let from: Date | undefined;
  let to: Date | undefined;

  if (fromRaw) {
    const d = new Date(fromRaw as string);
    if (isNaN(d.getTime())) {
      return apiResponse.badRequest(res, 'Invalid from date');
    }
    from = d;
  }

  if (toRaw) {
    const d = new Date(toRaw as string);
    if (isNaN(d.getTime())) {
      return apiResponse.badRequest(res, 'Invalid to date');
    }
    to = d;
  }

  const stats = await adminService.getTariffStatistics(from, to);
  apiResponse.success(res, stats);
};