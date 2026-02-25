import { UserPlan, UserPlanStatus } from '../models/UserPlan';
import { Transaction as SequelizeTransaction } from 'sequelize';
import { Op } from 'sequelize';

const ACTIVE_STATUSES: UserPlanStatus[] = ['trial', 'active', 'overdue', 'cancelled'];

export const findById = (id: string, t?: SequelizeTransaction) => {
  return UserPlan.findByPk(id, {
    transaction: t,
  });
};

export const findByIdWithPlan = (id: string, t?: SequelizeTransaction) => {
  return UserPlan.findByPk(id, {
    include: [{ association: 'plan', required: true }],
    transaction: t,
  });
};

export const findActiveByUserId = (userId: string, t?: SequelizeTransaction) => {
  return UserPlan.findOne({
    where: {
      userId,
      status: { [Op.in]: ACTIVE_STATUSES },
    },
    include: [{ association: 'plan', required: true }],
    order: [['createdAt', 'DESC']],
    transaction: t,
  });
};

export const findAllByUserId = (userId: string, t?: SequelizeTransaction) => {
  return UserPlan.findAll({
    where: { userId },
    include: [{ association: 'plan', required: true }],
    order: [['createdAt', 'DESC']],
    transaction: t,
  });
};

export const create = (
  data: Partial<UserPlan>,
  t?: SequelizeTransaction
) => {
  return UserPlan.create(data as Parameters<typeof UserPlan.create>[0], {
    transaction: t,
  });
};

export const update = (
  userPlan: UserPlan,
  data: Partial<UserPlan>,
  t?: SequelizeTransaction
) => {
  return userPlan.update(data, { transaction: t });
};

export const countActiveByUserId = (userId: string, t?: SequelizeTransaction) => {
  return UserPlan.count({
    where: {
      userId,
      status: { [Op.in]: ACTIVE_STATUSES },
    },
    transaction: t,
  });
};

export const findSubscriptionsToRenew = (now: Date, t?: SequelizeTransaction) => {
  return UserPlan.findAll({
    where: {
      status: 'active',
      autoRenew: true,
      endDate: { [Op.lte]: now },
    },
    include: [
      {
        association: 'plan',
        required: true,
        where: { type: 'subscription' },
      },
    ],
    transaction: t,
  });
};

export const findOverdueToExpire = (now: Date, t?: SequelizeTransaction) => {
  return UserPlan.findAll({
    where: {
      status: 'overdue',
      gracePeriodEnd: { [Op.lte]: now },
    },
    transaction: t,
  });
};

export const findExpiredTrials = (now: Date, t?: SequelizeTransaction) => {
  return UserPlan.findAll({
    where: {
      status: 'trial',
      endDate: { [Op.lte]: now },
    },
    transaction: t,
  });
};

export const findExpiredPlans = (now: Date, t?: SequelizeTransaction) => {
  return UserPlan.findAll({
    where: {
      status: { [Op.in]: ['active', 'cancelled'] as UserPlanStatus[] },
      endDate: { [Op.lte]: now },
      [Op.or]: [
        { status: 'cancelled' },
        { status: 'active', autoRenew: false },
      ],
    },
    transaction: t,
  });
};
