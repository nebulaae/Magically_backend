import { Op } from 'sequelize';
import { User } from '../../user/models/User';
import * as searchRepository from '../repository/searchRepository';

const addIsFollowingInfoToUsers = async (
  users: User[],
  currentUserId: string
) => {
  if (users.length === 0) return [];
  const userIds = users.map((u) => u.id);
  const subscriptions = await searchRepository.findSubscriptions(
    currentUserId,
    userIds
  );
  const followingIds = new Set(subscriptions.map((s) => s.followingId));

  return users.map((user) => {
    const { password, ...userJson } = user.toJSON();
    return { ...userJson, isFollowing: followingIds.has(user.id) };
  });
};

export const searchAll = async (
  query: string,
  type: string,
  sortBy: string,
  hashtag: string,
  currentUserId: string
) => {
  let usersResult = [];
  let publicationsResult = [];

  if (type === 'all' || type === 'publications') {
    const pubWhere: any = {};
    let pubOrder: any = [['createdAt', 'DESC']];

    if (query) {
      pubWhere[Op.or] = [
        { content: { [Op.iLike]: `%${query}%` } },
        { '$author.username$': { [Op.iLike]: `%${query}%` } },
      ];
    }
    if (hashtag) pubWhere.content = { [Op.iLike]: `%#${hashtag}%` };
    if (sortBy === 'popular') pubOrder = [['likeCount', 'DESC']];
    else if (sortBy === 'oldest') pubOrder = [['createdAt', 'ASC']];

    publicationsResult = await searchRepository.findPublicationsByQuery(
      pubWhere,
      pubOrder
    );
  }

  if ((type === 'all' || type === 'users') && query) {
    const users = await searchRepository.findUsersByQuery(query, currentUserId);
    usersResult = await addIsFollowingInfoToUsers(users, currentUserId);
  }

  return { users: usersResult, publications: publicationsResult };
};
