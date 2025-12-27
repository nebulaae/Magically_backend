import * as adminRepository from "../repository/adminRepository";
import { User } from "../../user/models/User";
import { Comment } from "../../comment/models/Comment";
import { generateToken } from "../../../shared/utils/jwt";
import { Publication } from "../../publication/models/Publication";
import { GenerationJob } from "../../publication/models/GenerationJob";
import { Transaction as TxModel } from "../../transaction/models/Transaction";
import { performTransaction } from "../../transaction/service/transactionService";

export const loginAdmin = async (username: string, password) => {
  const adminUser = await adminRepository.findAdminByUsername(username);

  if (!adminUser || !(await adminUser.comparePassword(password))) {
    return null;
  }

  const token = generateToken(adminUser.id);
  return { token, user: adminUser };
};

export const getAllUsers = () => {
  return adminRepository.findAllUsers();
};

export const blockUser = async (userId: string) => {
  const user = await adminRepository.findUserById(userId);
  if (!user) {
    return null;
  }
  await adminRepository.updateUserBlockStatus(user, true);
  return user;
};

export const unblockUser = async (userId: string) => {
  const user = await adminRepository.findUserById(userId);
  if (!user) {
    return null;
  }
  await adminRepository.updateUserBlockStatus(user, false);
  return user;
};

export const deletePublication = async (publicationId: string) => {
  const publication = await adminRepository.findPublicationById(publicationId);
  if (!publication) {
    return null;
  }
  await adminRepository.deletePublicationById(publication);
  return true;
};

export const setPhotoOfTheDay = (publicationId: string) => {
  return adminRepository.setPublicationAsPhotoOfTheDay(publicationId);
};

export const addTokensToUser = async (adminId: string, targetUserId: string, amount: number, reason: string) => {
  const description = `Admin Gift: ${reason} (by Admin)`;
  return await performTransaction(targetUserId, amount, "credit", description);
};

export const deleteComment = async (commentId: string) => {
  const comment = await Comment.findByPk(commentId);
  if (!comment) return null;
  await comment.destroy(); 
  return true;
};

export const getFullAnalytics = async () => {
  const [
    usersCount,
    publicationsCount,
    generationsTotal,
    generationsPending,
    spentTokensResult
  ] = await Promise.all([
    User.count(),
    Publication.count(),
    GenerationJob.count(),
    GenerationJob.count({ where: { status: 'pending' } }),
    TxModel.sum('amount', { where: { type: 'debit' } })
  ]);

  return {
    users: { total: usersCount },
    content: { publications: publicationsCount },
    generations: { total: generationsTotal, pending: generationsPending },
    economy: { totalTokensSpent: spentTokensResult || 0 }
  };
};