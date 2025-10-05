import { User } from "../../user/models/User";
import { Publication } from "../../publication/models/Publication";
import db from "../../../shared/config/database";

export const findAdminByUsername = (username: string) => {
  return User.findOne({ where: { username, role: "admin" } });
};

export const findAllUsers = () => {
  return User.findAll({ attributes: { exclude: ["password"] } });
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

export const setPublicationAsPhotoOfTheDay = async (publicationId: string) => {
  const t = await db.transaction();
  try {
    // Unset existing photo of the day
    await Publication.update(
      { isPhotoOfTheDay: false },
      { where: { isPhotoOfTheDay: true }, transaction: t },
    );

    // Set the new one
    const [updatedCount] = await Publication.update(
      { isPhotoOfTheDay: true },
      { where: { id: publicationId }, transaction: t },
    );

    await t.commit();
    return updatedCount > 0;
  } catch (error) {
    await t.rollback();
    throw error;
  }
};
