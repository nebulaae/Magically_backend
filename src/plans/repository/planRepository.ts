import { Plan, PlanType } from '../models/Plan';
import { Transaction as SequelizeTransaction } from 'sequelize';
import { Op } from 'sequelize';

export interface FindPlansFilter {
  type?: PlanType;
  isActive?: boolean;
}

export const findById = (id: string, t?: SequelizeTransaction) => {
  return Plan.findByPk(id, { transaction: t });
};

export const findAll = (
  filter: FindPlansFilter = {},
  t?: SequelizeTransaction
) => {
  const where: Record<string, unknown> = {};
  if (filter.type != null) where.type = filter.type;
  if (filter.isActive != null) where.isActive = filter.isActive;
  return Plan.findAll({
    where: Object.keys(where).length ? where : undefined,
    order: [['type', 'ASC'], ['price', 'ASC']],
    transaction: t,
  });
};

export const findActiveByType = (type: PlanType, t?: SequelizeTransaction) => {
  return Plan.findAll({
    where: { type, isActive: true },
    order: [['price', 'ASC']],
    transaction: t,
  });
};

export const create = (
  data: Partial<Plan>,
  t?: SequelizeTransaction
) => {
  return Plan.create(data as Parameters<typeof Plan.create>[0], {
    transaction: t,
  });
};

export const update = (
  plan: Plan,
  data: Partial<Plan>,
  t?: SequelizeTransaction
) => {
  return plan.update(data, { transaction: t });
};

export const countByName = (name: string, excludeId?: string) => {
  const where: Record<string, unknown> = { name };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  return Plan.count({ where });
};
