import { Transaction } from 'sequelize';
import { TrainingModel } from '../models/TrainingModel';
import { Gallery } from '../../gallery/models/Gallery';
import { Publication } from '../../publication/models/Publication';

// CRUD для моделей
export const createModel = (
  data: Partial<TrainingModel>,
  transaction?: Transaction
) => {
  return TrainingModel.create(data as any, { transaction });
};

export const findModelsByUserId = (userId: string) => {
  return TrainingModel.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
  });
};

export const findModelById = (id: string) => {
  return TrainingModel.findByPk(id);
};

export const updateModel = (
  model: TrainingModel,
  data: Partial<TrainingModel>,
  transaction?: Transaction
) => {
  return model.update(data, { transaction });
};

export const deleteModel = (
  model: TrainingModel,
  transaction?: Transaction
) => {
  return model.destroy({ transaction });
};

export const createPublication = (data: any, transaction: Transaction) => {
  return Publication.create(data, { transaction });
};

export const createGalleryItem = (data: any, transaction: Transaction) => {
  return Gallery.create(data, { transaction });
};
