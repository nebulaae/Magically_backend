import { Op } from 'sequelize';
import { User } from '../../user/models/User';

export const findUserById = (id: string) => {
  return User.findOne({ where: { id } });
};

export const findUserByEmail = (email: string) => {
  return User.findOne({ where: { email } });
};

export const findVerifiedUserByEmail = (email: string) => {
  return User.findOne({ where: { email, verified: true } });
};

export const findUserByUsername = (username: string) => {
  return User.findOne({ where: { username } });
};

export const findUserForLogin = (usernameOrEmail: string) => {
  return User.findOne({
    where: {
      [Op.or]: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
    },
  });
};

export const findUsersWithActiveResetTokens = () => {
  return User.findAll({
    where: {
      passwordResetTokenExpires: { [Op.gt]: new Date() },
    },
  });
};

export const createUser = (userData: Partial<User>) => {
  return User.create(userData);
};

export const updateUser = (user: User, updates: Partial<User>) => {
  Object.assign(user, updates);
  return user.save();
};
