import { Op } from "sequelize";
import * as galleryRepository from "../repository/galleryRepository";

export const getUserGallery = (
  userId: string,
  sortBy: string,
  searchQuery: string,
  date: string,
) => {
  let order: any = [["createdAt", "DESC"]];
  if (sortBy === "oldest") {
    order = [["createdAt", "ASC"]];
  }

  let whereClause: any = {};
  if (searchQuery) {
    whereClause.prompt = { [Op.iLike]: `%${searchQuery}%` };
  }
  if (date) {
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 1);
    whereClause.createdAt = { [Op.gte]: startDate, [Op.lt]: endDate };
  }

  return galleryRepository.findGalleryItemsByUserId(userId, whereClause, order);
};
