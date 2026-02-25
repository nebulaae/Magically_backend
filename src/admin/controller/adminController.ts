import { Request, Response } from 'express';
import * as adminService from '../service/adminService';
import * as apiResponse from '../../../shared/utils/apiResponse';
import logger from '../../../shared/utils/logger';
import { Publication } from '../../publication/models/Publication';
import { User } from '../../user/models/User';

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const result = await adminService.loginAdmin(username, password);

  if (!result) {
    return apiResponse.unauthorized(res, 'Invalid admin credentials');
  }

  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('admin_token', result.token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
  });

  apiResponse.success(res, result, 'Admin login successful.');
};

export const logout = (_req: Request, res: Response) => {
  res.clearCookie('admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  apiResponse.success(res, null, 'Admin logged out successfully.');
};

export const getAllUsers = async (_req: Request, res: Response) => {
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
    where: { isTrend: false }, // Обычные юзерские посты
    include: [{ model: User, as: 'author', attributes: ['id', 'username'] }],
    order: [['createdAt', 'DESC']],
    limit: Number(limit),
    offset,
  });
  apiResponse.success(res, publications);
};

// CRUD Трендов
export const listTrends = async (req: Request, res: Response) => {
  const trends = await Publication.findAll({
    where: { isTrend: true },
    order: [['createdAt', 'DESC']],
  });
  apiResponse.success(res, trends);
};

export const createTrend = async (req: Request, res: Response) => {
  const { content, coverText, trendingImageSet, trendingCover } = req.body; // В идеале тут multer для файлов, но для примера берем из body
  const trend = await Publication.create({
    content,
    coverText,
    trendingCover,
    trendingImageSet,
    isTrend: true,
    adminId: req.user.id,
    userId: req.user.id, // Временно, если БД требует userId (лучше сделать allowNull: true в БД)
  });
  apiResponse.success(res, trend, 'Trend created');
};

export const updateTrend = async (req: Request, res: Response) => {
  const { id } = req.params;
  const trend = await Publication.findByPk(Array.isArray(id) ? id[0] : id);
  if (!trend) return apiResponse.notFound(res, 'Trend not found');
  await trend.update(req.body);
  apiResponse.success(res, trend, 'Trend updated');
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
