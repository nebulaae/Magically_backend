import { Transaction } from "sequelize";
import { Gallery } from "../../gallery/models/Gallery";
import { Publication } from "../../publication/models/Publication";

export const createPublication = (data: any, transaction: Transaction) => {
  return Publication.create(data, { transaction });
};

export const createGalleryItem = (data: any, transaction: Transaction) => {
  return Gallery.create(data, { transaction });
};