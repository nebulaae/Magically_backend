import { Op } from 'sequelize';
import { Publication } from '../models/Publication';
import { User } from '../../user/models/User';
import { Subscription } from '../../user/models/Subscription';
import { LikedPublication } from '../models/LikedPublication';
import { Transaction } from 'sequelize';

export const findPublicationById = (publicationId: string) => {
  return Publication.findByPk(publicationId, {
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'fullname', 'avatar'],
      },
    ],
  });
};

export const findAndCountAllPublications = (options: {
  where: any;
  order: any;
  limit: number;
  offset: number;
}) => {
  return Publication.findAndCountAll({
    ...options,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'fullname', 'avatar'],
      },
    ],
  });
};

export const findSubscriptions = (
  followerId: string,
  followingIds: string[]
) => {
  return Subscription.findAll({
    where: { followerId, followingId: { [Op.in]: followingIds } },
  });
};

export const findLikes = (userId: string, publicationIds: string[]) => {
  return LikedPublication.findAll({
    where: { userId, publicationId: { [Op.in]: publicationIds } },
  });
};

export const findOneSubscription = (
  followerId: string,
  followingId: string
) => {
  return Subscription.findOne({ where: { followerId, followingId } });
};

export const findOneLike = (userId: string, publicationId: string) => {
  return LikedPublication.findOne({ where: { userId, publicationId } });
};

export const createPublication = (data: Partial<Publication>) => {
  return Publication.create(data);
};

export const updatePublication = (
  publication: Publication,
  content: string
) => {
  publication.content = content;
  return publication.save();
};

export const deletePublication = (publication: Publication) => {
  return publication.destroy();
};

export const createLike = (
  userId: string,
  publicationId: string,
  transaction: Transaction
) => {
  return LikedPublication.create({ userId, publicationId }, { transaction });
};

export const deleteLike = (
  userId: string,
  publicationId: string,
  transaction: Transaction
) => {
  return LikedPublication.destroy({
    where: { userId, publicationId },
    transaction,
  });
};

export const findUserById = (userId: string, transaction?: Transaction) => {
  const options = transaction ? { transaction } : {};
  return User.findByPk(userId, options);
};

export const findLikedPublicationsByUserId = (userId: string) => {
  return LikedPublication.findAll({
    where: { userId },
    include: [
      {
        model: Publication,
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'fullname', 'avatar'],
          },
        ],
      },
    ],
    order: [[Publication, 'createdAt', 'DESC']],
  });
};
