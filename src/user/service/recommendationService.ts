import { Op } from 'sequelize';
import { User } from '../../user/models/User';
import { Subscription } from '../../user/models/Subscription';
import logger from '../../../shared/utils/logger';

export const getRecommendedUsers = async (
  userId: string,
  limit: number = 10
) => {
  try {
    // Получаем список тех, на кого подписан пользователь
    const following = await Subscription.findAll({
      where: { followerId: userId },
      attributes: ['followingId'],
      raw: true,
    });

    const followingIds = following.map((f) => f.followingId);

    // Если нет подписок, возвращаем недавно зарегистрированных пользователей
    if (followingIds.length === 0) {
      const recentUsers = await User.findAll({
        where: {
          id: { [Op.ne]: userId },
          verified: true,
        },
        attributes: ['id', 'username', 'fullname', 'avatar', 'bio'],
        limit,
        order: [['createdAt', 'DESC']],
      });

      return recentUsers.map((user) => ({
        ...user.toJSON(),
        isFollowing: false,
      }));
    }

    // Находим друзей друзей (рекомендации второго уровня)
    const friendsOfFriends = await Subscription.findAll({
      where: {
        followerId: { [Op.in]: followingIds },
        followingId: {
          [Op.and]: [
            { [Op.ne]: userId },
            { [Op.notIn]: [...followingIds, userId] },
          ],
        },
      },
      attributes: ['followingId'],
      raw: true,
    });

    // Убираем дубликаты
    const recommendedIds = [
      ...new Set(friendsOfFriends.map((f) => f.followingId)),
    ];

    // Если нет рекомендаций второго уровня, возвращаем недавних пользователей
    if (recommendedIds.length === 0) {
      const fallbackUsers = await User.findAll({
        where: {
          id: {
            [Op.and]: [
              { [Op.ne]: userId },
              { [Op.notIn]: [...followingIds, userId] },
            ],
          },
          verified: true,
        },
        attributes: ['id', 'username', 'fullname', 'avatar', 'bio'],
        limit,
        order: [['createdAt', 'DESC']],
      });

      return fallbackUsers.map((user) => ({
        ...user.toJSON(),
        isFollowing: false,
      }));
    }

    // Получаем рекомендованных пользователей
    const recommendedUsers = await User.findAll({
      where: {
        id: { [Op.in]: recommendedIds },
        verified: true,
      },
      attributes: ['id', 'username', 'fullname', 'avatar', 'bio'],
      limit,
    });

    // Если получили меньше, чем лимит, дополняем недавними
    if (recommendedUsers.length < limit) {
      const additionalUsers = await User.findAll({
        where: {
          id: {
            [Op.and]: [
              { [Op.ne]: userId },
              { [Op.notIn]: [...followingIds, ...recommendedIds, userId] },
            ],
          },
          verified: true,
        },
        attributes: ['id', 'username', 'fullname', 'avatar', 'bio'],
        limit: limit - recommendedUsers.length,
        order: [['createdAt', 'DESC']],
      });

      return [
        ...recommendedUsers.map((user) => ({
          ...user.toJSON(),
          isFollowing: false,
        })),
        ...additionalUsers.map((user) => ({
          ...user.toJSON(),
          isFollowing: false,
        })),
      ];
    }

    return recommendedUsers.map((user) => ({
      ...user.toJSON(),
      isFollowing: false,
    }));
  } catch (error) {
    logger.error(`Get recommended users error: ${error.message}`);
    // В случае ошибки возвращаем недавних пользователей
    const fallbackUsers = await User.findAll({
      where: {
        id: { [Op.ne]: userId },
        verified: true,
      },
      attributes: ['id', 'username', 'fullname', 'avatar', 'bio'],
      limit,
      order: [['createdAt', 'DESC']],
    });

    return fallbackUsers.map((user) => ({
      ...user.toJSON(),
      isFollowing: false,
    }));
  }
};
