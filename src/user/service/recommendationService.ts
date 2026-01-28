import { Op } from 'sequelize';
import { User } from '../../user/models/User';
import { Subscription } from '../../user/models/Subscription';

export const getRecommendedUsers = async (
  userId: string,
  limit: number = 10
) => {
  const following = await Subscription.findAll({
    where: { followerId: userId },
    attributes: ['followingId'],
  });
  const followingIds = following.map((f) => f.followingId);

  if (followingIds.length === 0) {
    return await User.findAll({
      where: {
        id: { [Op.ne]: userId },
        verified: true,
      },
      attributes: ['id', 'username', 'fullname', 'avatar', 'bio'],
      limit,
      order: [['createdAt', 'DESC']],
    });
  }

  const friendsOfFriends = await Subscription.findAll({
    where: {
      followerId: { [Op.in]: followingIds },
      followingId: {
        [Op.and]: [{ [Op.ne]: userId }, { [Op.notIn]: followingIds }],
      },
    },
    attributes: ['followingId'],
    group: ['followingId'],
  });

  const recommendedIds = [
    ...new Set(friendsOfFriends.map((f) => f.followingId)),
  ].slice(0, limit);

  if (recommendedIds.length === 0) {
    return await User.findAll({
      where: {
        id: {
          [Op.and]: [{ [Op.ne]: userId }, { [Op.notIn]: followingIds }],
        },
        verified: true,
      },
      attributes: ['id', 'username', 'fullname', 'avatar', 'bio'],
      limit,
      order: [['createdAt', 'DESC']],
    });
  }

  const recommendedUsers = await User.findAll({
    where: {
      id: { [Op.in]: recommendedIds },
    },
    attributes: ['id', 'username', 'fullname', 'avatar', 'bio'],
    limit,
  });

  return recommendedUsers.map((user) => ({
    ...user.toJSON(),
    isFollowing: false,
  }));
};
