import db from '../../../shared/config/database';
import { Op } from 'sequelize';
import { User } from '../../user/models/User';
import { Publication } from '../models/Publication';
import { findUserById } from '../repository/publicationRepository';
import { handleUserAction } from '../../../shared/utils/userActions';
import {
  getFromCache,
  setInCache,
  invalidateCache,
} from '../../../shared/config/redis';
import * as commentService from '../../comment/service/commentService';
import * as publicationRepository from '../repository/publicationRepository';

const addExtraInfoToPublications = async (
  publications: Publication[],
  userId: string
) => {
  if (publications.length === 0) return [];
  const authorIds = publications.map((p) => p.userId);
  const publicationIds = publications.map((p) => p.id);

  const following = await publicationRepository.findSubscriptions(
    userId,
    authorIds
  );
  const followingIds = new Set(following.map((sub) => sub.followingId));

  const liked = await publicationRepository.findLikes(userId, publicationIds);
  const likedPublicationIds = new Set(liked.map((like) => like.publicationId));

  return publications.map((p) => ({
    ...p.toJSON(),
    isFollowing: followingIds.has(p.userId),
    isLiked: likedPublicationIds.has(p.id),
  }));
};

export const getPublicationById = async (
  publicationId: string,
  userId: string
) => {
  const publication =
    await publicationRepository.findPublicationById(publicationId);
  if (!publication) {
    throw new Error('Publication not found');
  }

  const comments = await commentService.getCommentsForPublication(
    publication.id
  );
  const isFollowing = !!(await publicationRepository.findOneSubscription(
    userId,
    publication.userId
  ));
  const isLiked = !!(await publicationRepository.findOneLike(
    userId,
    publication.id
  ));

  return {
    ...publication.toJSON(),
    isFollowing,
    isLiked,
    comments,
  };
};

export const getAllPublications = async (
  userId: string,
  page: number,
  limit: number,
  sortBy: string,
  hashtag: string
) => {
  const cacheKey = `publications:all:page${page}:limit${limit}:sort${sortBy}:ht${hashtag}`;
  const cachedData = await getFromCache<any>(cacheKey);
  if (cachedData) return cachedData;

  const offset = (page - 1) * limit;
  let order: any = [['createdAt', 'DESC']];
  if (sortBy === 'popular') order = [['likeCount', 'DESC']];
  else if (sortBy === 'oldest') order = [['createdAt', 'ASC']];

  const whereClause: any = {};
  if (hashtag) whereClause.content = { [Op.iLike]: `%#${hashtag}%` };

  const { count, rows: publications } =
    await publicationRepository.findAndCountAllPublications({
      where: whereClause,
      order,
      limit,
      offset,
    });
  const publicationsWithInfo = await addExtraInfoToPublications(
    publications,
    userId
  );

  const responseData = {
    publications: publicationsWithInfo,
    nextPage: count > page * limit ? page + 1 : undefined,
  };
  await setInCache(cacheKey, responseData, 300);
  return responseData;
};

export const createPublication = async (
  userId: string,
  content: string,
  imageUrl?: string
) => {
  const publication = await publicationRepository.createPublication({
    userId,
    content,
    imageUrl,
    category: 'Not defined',
  });
  await invalidateCache(`public:/api/publications`);
  return publication;
};

export const updatePublication = async (
  publicationId: string,
  userId: string,
  content: string
) => {
  const user = await findUserById(userId);
  const publication =
    await publicationRepository.findPublicationById(publicationId);
  if (!publication) throw new Error('Publication not found');
  if (publication.userId !== userId)
    throw new Error('You are not authorized to edit this publication');

  const updatedPublication = await publicationRepository.updatePublication(
    publication,
    content
  );
  await invalidateCache('publications:all:*');
  await invalidateCache(`user:profile:${user.username}`);
  return updatedPublication;
};

export const deletePublication = async (
  publicationId: string,
  userId: string
) => {
  const user = await findUserById(userId);
  const publication =
    await publicationRepository.findPublicationById(publicationId);
  if (!publication) throw new Error('Publication not found');
  if (publication.userId !== userId)
    throw new Error('You are not authorized to delete this publication');

  await invalidateCache('publications:all:*');
  await invalidateCache(`user:profile:${user.username}`);
  await publicationRepository.deletePublication(publication);
  return { message: 'Publication deleted successfully.' };
};

export const likePublication = async (
  publicationId: string,
  userId: string
) => {
  const publication =
    await publicationRepository.findPublicationById(publicationId);
  if (!publication) throw new Error('Publication not found');

  const user = await publicationRepository.findUserById(userId);
  if (!user) throw new Error('User not found');

  await db.transaction(async (t) => {
    await publicationRepository.createLike(userId, publicationId, t);
    await publication.increment('likeCount', { transaction: t });
    if (publication.category) {
      const currentInterests = user.interests || [];
      if (!currentInterests.includes(publication.category)) {
        user.interests = [...currentInterests, publication.category];
        await user.save({ transaction: t });
      }
    }
    await handleUserAction(user, 1, t);
  });

  await invalidateCache('publications:all:*');
  await invalidateCache(`user:profile:${user.username}`);
  return { message: 'Publication liked successfully' };
};

export const unlikePublication = async (
  publicationId: string,
  userId: string
) => {
  const publication =
    await publicationRepository.findPublicationById(publicationId);
  if (!publication) throw new Error('Publication not found');
  const user = await publicationRepository.findUserById(userId);

  await db.transaction(async (t) => {
    const result = await publicationRepository.deleteLike(
      userId,
      publicationId,
      t
    );
    if (result === 0) throw new Error('Not liked');
    if (publication.likeCount > 0) {
      await publication.decrement('likeCount', { transaction: t });
    }
  });

  await invalidateCache('publications:all:*');
  await invalidateCache(`user:profile:${user.username}`);
  return { message: 'Publication unliked successfully' };
};

export const getMyLikedPublications = async (userId: string) => {
  const user = await publicationRepository.findUserById(userId);
  if (!user) throw new Error('User not found');
  const likedPublications = await user.getLikedPublications({
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'fullname', 'avatar'],
      },
    ],
    order: [['createdAt', 'DESC']],
  });
  return addExtraInfoToPublications(likedPublications, userId);
};
