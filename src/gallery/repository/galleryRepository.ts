import { Op } from "sequelize";
import { Gallery } from "../models/Gallery";

export const findGalleryItemsByUserId = (
  userId: string,
  whereClause: any,
  order: any,
) => {
  return Gallery.findAll({
    where: { userId, ...whereClause },
    order,
  });
};
