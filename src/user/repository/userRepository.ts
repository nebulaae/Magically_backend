import { Op } from "sequelize";
import { User } from "../models/User";
import { Subscription } from "../models/Subscription";
import { Publication } from "../../publication/models/Publication";

export const findUserBy = (where: { [key: string]: any }) => {
  return User.findOne({
    where,
    attributes: { exclude: ["password", "email"] },
  });
};

export const findUserByPk = (
  userId: string,
  exclude: string[] = ["password"],
) => {
  return User.findByPk(userId, { attributes: { exclude } });
};

export const findUserPublications = (userId: string) => {
  return Publication.findAll({
    where: { userId },
    include: [
      {
        model: User,
        as: "author",
        attributes: ["id", "username", "fullname", "avatar"],
      },
    ],
    order: [["createdAt", "DESC"]],
  });
};

export const countFollowers = (userId: string) => {
  return Subscription.count({ where: { followingId: userId } });
};

export const countFollowing = (userId: string) => {
  return Subscription.count({ where: { followerId: userId } });
};

export const findSubscription = (followerId: string, followingId: string) => {
  return Subscription.findOne({ where: { followerId, followingId } });
};

export const getFollowers = (userId: string) => {
  return User.findByPk(userId, {
    include: [
      {
        model: User,
        as: "Followers",
        attributes: ["id", "username", "fullname", "avatar"],
        through: { attributes: [] },
      },
    ],
  });
};

export const getFollowing = (userId: string) => {
  return User.findByPk(userId, {
    include: [
      {
        model: User,
        as: "Following",
        attributes: ["id", "username", "fullname", "avatar"],
        through: { attributes: [] },
      },
    ],
  });
};

export const updateUser = (user: User, data: Partial<User>) => {
  return user.update(data);
};

export const searchUsersByQuery = (query: string, currentUserId: string) => {
  return User.findAll({
    where: {
      [Op.or]: [
        { username: { [Op.iLike]: `%${query}%` } },
        { fullname: { [Op.iLike]: `%${query}%` } },
      ],
      id: { [Op.ne]: currentUserId },
    },
    attributes: ["id", "username", "fullname", "bio", "avatar"],
    limit: 10,
  });
};

export const createSubscription = (followerId: string, followingId: string) => {
  return Subscription.create({ followerId, followingId });
};

export const deleteSubscription = (followerId: string, followingId: string) => {
  return Subscription.destroy({ where: { followerId, followingId } });
};
