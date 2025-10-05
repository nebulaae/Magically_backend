import * as adminRepository from "../repository/adminRepository";
import { generateToken } from "../../../shared/utils/jwt";
import { User } from "../../user/models/User";

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
