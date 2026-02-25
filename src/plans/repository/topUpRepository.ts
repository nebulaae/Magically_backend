import { TopUp } from '../models/TopUp';
import { Transaction as SequelizeTransaction } from 'sequelize';

export const create = (
  data: Partial<TopUp>,
  t?: SequelizeTransaction
) => {
  return TopUp.create(data as Parameters<typeof TopUp.create>[0], {
    transaction: t,
  });
};

export const findById = (id: string, t?: SequelizeTransaction) => {
  return TopUp.findByPk(id, { transaction: t });
};

export const findByUserPlanId = (
  userPlanId: string,
  t?: SequelizeTransaction
) => {
  return TopUp.findAll({
    where: { userPlanId },
    order: [['createdAt', 'DESC']],
    transaction: t,
  });
};

export const findByUserId = (userId: string, t?: SequelizeTransaction) => {
  return TopUp.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    transaction: t,
  });
};
