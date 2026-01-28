import { Transaction } from 'sequelize';
import { TtModel } from '../models/TtModel';
import { Gallery } from '../../gallery/models/Gallery';
import { Publication } from '../../publication/models/Publication';

export const createModel = (
  data: Partial<TtModel>,
  transaction?: Transaction
) => {
  return TtModel.create(data as any, { transaction });
};

export const findModelsByUserId = (userId: string) => {
  return TtModel.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
};

export const findModelById = (id: string) => {
  return TtModel.findByPk(id);
};

export const updateModel = (
  model: TtModel,
  data: Partial<TtModel>,
  transaction?: Transaction
) => {
  return model.update(data, { transaction });
};

export const deleteModel = (model: TtModel, transaction?: Transaction) => {
  return model.destroy({ transaction });
};

// Для поллера (сохранение результата)
export const createPublication = (data: any, transaction: Transaction) => {
  return Publication.create(data, { transaction });
};

export const createGalleryItem = (data: any, transaction: Transaction) => {
  return Gallery.create(data, { transaction });
};
