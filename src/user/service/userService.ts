import db from '../../../shared/config/database';
import { User } from '../models/User';
import { handleUserAction } from '../../../shared/utils/userActions';
import {
  getFromCache,
  setInCache,
  invalidateCache,
} from '../../../shared/config/redis';
import * as userRepository from '../repository/userRepository';
import { s3Storage } from '../../../shared/config/s3Storage';

const addIsFollowingInfoToUsers = async (
  users: User[],
  currentUserId: string
) => {
  if (!users || users.length === 0) return [];
  const promises = users.map(async (user) => {
    const isFollowing = !!(await userRepository.findSubscription(
      currentUserId,
      user.id
    ));
    const { password, ...userJson } = user.toJSON();
    return { ...userJson, isFollowing };
  });
  return Promise.all(promises);
};

export const getProfileByUsername = async (
  username: string,
  currentUserId: string
) => {
  const cacheKey = `user:profile:${username}`;
  const cachedData = await getFromCache<any>(cacheKey);
  if (cachedData) return cachedData;

  const user = await userRepository.findUserBy({ username });
  if (!user) throw new Error('User not found');

  const publications = await userRepository.findUserPublications(user.id);
  // This function needs to be exposed or moved from publicationService
  // For now, let's assume a simplified version exists or is passed
  const publicationsWithInfo = await addExtraInfoToPublications(
    publications,
    currentUserId
  );

  const [followersCount, followingCount] = await Promise.all([
    userRepository.countFollowers(user.id),
    userRepository.countFollowing(user.id),
  ]);

  const isFollowing =
    currentUserId !== user.id
      ? !!(await userRepository.findSubscription(currentUserId, user.id))
      : false;

  const responseData = {
    ...user.get({ plain: true }),
    publicationsCount: publications.length,
    followersCount,
    followingCount,
    isFollowing,
    publications: publicationsWithInfo,
  };
  await setInCache(cacheKey, responseData, 3600);
  return responseData;
};

// Simplified version for the user module
const addExtraInfoToPublications = async (publications, userId) => {
  return publications.map((p) => p.toJSON());
};

export const getMyProfile = async (userId: string) => {
  const user = await userRepository.findUserByPk(userId, ['password']);
  if (!user) throw new Error('User not found');

  const publications = await userRepository.findUserPublications(user.id);
  const publicationsWithInfo = await addExtraInfoToPublications(
    publications,
    userId
  );
  const [followersCount, followingCount] = await Promise.all([
    userRepository.countFollowers(user.id),
    userRepository.countFollowing(user.id),
  ]);

  return {
    ...user.get({ plain: true }),
    publicationsCount: publications.length,
    followersCount,
    followingCount,
    publications: publicationsWithInfo,
  };
};

export const getMyFollowers = async (userId: string) => {
  const userWithFollowers = await userRepository.getFollowers(userId);
  if (!userWithFollowers) throw new Error('User not found');
  const followers = await userWithFollowers.getFollowers();
  return addIsFollowingInfoToUsers(followers, userId);
};

export const getMyFollowings = async (userId: string) => {
  const userWithFollowings = await userRepository.getFollowing(userId);
  if (!userWithFollowings) throw new Error('User not found');
  const following = await userWithFollowings.getFollowing();
  return addIsFollowingInfoToUsers(following, userId);
};

export const updateProfile = async (
  userId: string,
  profileData: { fullname?: string; bio?: string; interests?: string[] }
) => {
  const user = await userRepository.findUserByPk(userId);
  if (!user) throw new Error('User not found');

  const updatedUser = await userRepository.updateUser(user, profileData);
  await invalidateCache(`user:profile:${user.username}`);
  const { password, ...userResponse } = updatedUser.get({ plain: true });
  return userResponse;
};

export const updateAvatar = async (userId: string, avatarPath: string) => {
  const user = await userRepository.findUserByPk(userId);
  if (!user) throw new Error('User not found');

  if (user.avatar) {
    await s3Storage.deleteFile(user.avatar);
  }

  const updatedUser = await userRepository.updateUser(user, {
    avatar: avatarPath,
  });

  await invalidateCache(`user:profile:${user.username}`);
  const { password, ...userResponse } = updatedUser.get({ plain: true });
  return userResponse;
};

export const searchUsers = async (query: string, currentUserId: string) => {
  const users = await userRepository.searchUsersByQuery(query, currentUserId);
  return addIsFollowingInfoToUsers(users, currentUserId);
};

export const subscribe = async (followerId: string, followingId: string) => {
  if (followerId === followingId)
    throw new Error('You cannot follow yourself.');
  const userToFollow = await userRepository.findUserByPk(followingId);
  if (!userToFollow) throw new Error('User to follow not found');

  const me = await userRepository.findUserByPk(followerId);
  if (!me) throw new Error('Current user not found');

  await db.transaction(async (t) => {
    await userRepository.createSubscription(followerId, followingId);
    await handleUserAction(me, 3, t);
  });

  return { message: `Successfully followed ${userToFollow.username}` };
};

export const unsubscribe = async (followerId: string, followingId: string) => {
  const userToUnfollow = await userRepository.findUserByPk(followingId);
  if (!userToUnfollow) throw new Error('User to unfollow not found');

  const result = await userRepository.deleteSubscription(
    followerId,
    followingId
  );
  if (result === 0) throw new Error('You are not following this user.');

  return { message: `Successfully unfollowed ${userToUnfollow.username}` };
};

export const changeRoleToAdmin = async (userId: string) => {
  const user = await userRepository.findUserByPk(userId);
  if (!user) throw new Error('User not found');
  if (user.role === 'admin') throw new Error('User is already an admin.');

  const updatedUser = await userRepository.updateUser(user, { role: 'admin' });
  return updatedUser.get({ plain: true });
};
