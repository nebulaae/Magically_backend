import { Op } from 'sequelize';
import { User } from '../../user/models/User';
import { Publication } from '../../publication/models/Publication';
import { Subscription } from '../../user/models/Subscription';

export const findUsersByQuery = (query: string, currentUserId: string) => {
  return User.findAll({
    where: {
      [Op.or]: [
        { username: { [Op.iLike]: `%${query}%` } },
        { fullname: { [Op.iLike]: `%${query}%` } },
      ],
      id: { [Op.ne]: currentUserId },
    },
    attributes: ['id', 'username', 'fullname', 'bio', 'avatar'],
    limit: 10,
  });
};

export const findPublicationsByQuery = (pubWhere: any, pubOrder: any) => {
  return Publication.findAll({
    where: pubWhere,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'fullname', 'avatar'],
      },
    ],
    order: pubOrder,
    limit: 20,
  });
};

export const findSubscriptions = (currentUserId: string, userIds: string[]) => {
  return Subscription.findAll({
    where: {
      followerId: currentUserId,
      followingId: { [Op.in]: userIds },
    },
  });
};
