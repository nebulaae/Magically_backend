import { User } from '../../user/models/User';
import { Publication } from '../../publication/models/Publication';
import db from '../../../shared/config/database';

export const findAdminByUsername = (username: string) => {
  return User.findOne({ where: { username, role: 'admin' } });
};

export const findAllUsers = () => {
  return User.findAll({ attributes: { exclude: ['password'] } });
};

export const findUserById = (userId: string) => {
  return User.findByPk(userId);
};

export const updateUserBlockStatus = (user: User, isBlocked: boolean) => {
  user.isBlocked = isBlocked;
  return user.save();
};

export const findPublicationById = (publicationId: string) => {
  return Publication.findByPk(publicationId);
};

export const deletePublicationById = (publication: Publication) => {
  return publication.destroy();
};
