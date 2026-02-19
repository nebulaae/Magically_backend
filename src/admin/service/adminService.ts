import db from '../../../shared/config/database';
import { User } from '../../user/models/User';
import { Comment } from '../../comment/models/Comment';
import { generateToken } from '../../../shared/utils/jwt';
import { Publication } from '../../publication/models/Publication';
import { GenerationJob } from '../../publication/models/GenerationJob';
import { Transaction as TxModel } from '../../transaction/models/Transaction';
import { performTransaction } from '../../transaction/service/transactionService';
import * as adminRepository from '../repository/adminRepository';

export const loginAdmin = async (username: string, password) => {
  const adminUser = await adminRepository.findAdminByUsername(username);

  if (!adminUser || !(await adminUser.comparePassword(password))) {
    return null;
  }

  const token = generateToken(adminUser.id);
  return { token, user: adminUser };
};

export const getAllUsers = () => {
  return adminRepository.findAllUsers();
};

export const blockUser = async (userId: string) => {
  const user = await adminRepository.findUserById(userId);
  if (!user) {
    return null;
  }
  await adminRepository.updateUserBlockStatus(user, true);
  return user;
};

export const unblockUser = async (userId: string) => {
  const user = await adminRepository.findUserById(userId);
  if (!user) {
    return null;
  }
  await adminRepository.updateUserBlockStatus(user, false);
  return user;
};

export const deletePublication = async (publicationId: string) => {
  const publication = await adminRepository.findPublicationById(publicationId);
  if (!publication) {
    return null;
  }
  await adminRepository.deletePublicationById(publication);
  return true;
};

export const setPhotoOfTheDay = (publicationId: string) => {
  return adminRepository.setPublicationAsPhotoOfTheDay(publicationId);
};

export const addTokensToUser = async (
  adminId: string,
  targetUserId: string,
  amount: number,
  reason: string
) => {
  const description = `Admin Gift: ${reason} (by Admin)`;
  return await performTransaction(targetUserId, amount, 'credit', description);
};

export const deleteComment = async (commentId: string) => {
  const comment = await Comment.findByPk(commentId);
  if (!comment) return null;
  await comment.destroy();
  return true;
};

export const getFullAnalytics = async () => {
  // 1. Базовые метрики
  const [usersCount, publicationsCount, gensTotal, gensPending, totalSpent] = await Promise.all([
    User.count(), Publication.count(), GenerationJob.count(),
    GenerationJob.count({ where: { status: 'pending' } }),
    TxModel.sum('amount', { where: { type: 'debit' } }),
  ]);

  // 2. Исторические данные (для графиков)
  const getHistorical = (model: any, dateField = 'createdAt') =>
    model.findAll({
      attributes: [[db.fn('DATE', db.col(dateField)), 'date'], [db.fn('COUNT', db.col('id')), 'count']],
      group: [db.fn('DATE', db.col(dateField))],
      order: [[db.fn('DATE', db.col(dateField)), 'ASC']],
      raw: true,
    });

  const [usersHistory, pubsHistory, gensHistory] = await Promise.all([
    getHistorical(User), getHistorical(Publication), getHistorical(GenerationJob)
  ]);

  // 3. СЕГМЕНТАЦИЯ ПОЛЬЗОВАТЕЛЕЙ (Самая сочная часть)
  // Получаем всех юзеров с их агрегированной статой
  const usersWithStats = await User.findAll({
    attributes: [
      'id', 'username', 'email', 'createdAt',
      [db.literal('(SELECT COUNT(*) FROM training_models WHERE training_models."userId" = "User".id)'), 'modelCount'],
      [db.literal('(SELECT COUNT(*) FROM generation_jobs WHERE generation_jobs."userId" = "User".id)'), 'jobCount'],
      [db.literal('(SELECT MAX("createdAt") FROM generation_jobs WHERE generation_jobs."userId" = "User".id)'), 'lastGenDate']
    ],
    raw: true,
  });

  const now = new Date().getTime();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const segments = {
    active: [] as any[],         // Генерировали что-то за последние 3 дня
    registeredOnly: [] as any[], // Вошли, но нет ни моделей, ни генераций
    modelNoGen: [] as any[],     // Создали модель, но 0 генераций
    churned: [] as any[],        // Генерировали ранее, но последняя активность > 7 дней назад
  };

  usersWithStats.forEach((u: any) => {
    const modelCount = parseInt(u.modelCount || '0', 10);
    const jobCount = parseInt(u.jobCount || '0', 10);
    const daysSinceLastGen = u.lastGenDate ? (now - new Date(u.lastGenDate).getTime()) / ONE_DAY : null;

    if (modelCount === 0 && jobCount === 0) {
      segments.registeredOnly.push(u);
    } else if (modelCount > 0 && jobCount === 0) {
      segments.modelNoGen.push(u);
    } else if (jobCount > 0) {
      if (daysSinceLastGen !== null && daysSinceLastGen <= 3) {
        segments.active.push(u);
      } else if (daysSinceLastGen !== null && daysSinceLastGen > 7) {
        segments.churned.push(u);
      }
    }
  });

  return {
    overview: {
      users: usersCount,
      publications: publicationsCount,
      generationsTotal: gensTotal,
      generationsPending: gensPending,
      totalTokensSpent: totalSpent || 0,
    },
    historical: {
      users: usersHistory,
      publications: pubsHistory,
      generations: gensHistory,
    },
    segments: {
      active: segments.active,
      registeredOnly: segments.registeredOnly,
      modelNoGen: segments.modelNoGen,
      churned: segments.churned,
    }
  };
};