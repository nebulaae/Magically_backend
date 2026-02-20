import db from '../../../shared/config/database';
import { Model, DataTypes, Op } from 'sequelize';

const ACTIVE_STATUSES = ['trial', 'active', 'overdue', 'cancelled'] as const;
export type UserPlanStatus =
  | 'trial'
  | 'active'
  | 'overdue'
  | 'cancelled'
  | 'expired'
  | 'noplan';

export interface UserPlanAttributes {
  id: string;
  userId: string;
  planId: string;
  status: UserPlanStatus;
  startDate: Date;
  endDate: Date;
  tokensFromPlan: number;
  tokensFromTopup: number;
  autoRenew: boolean;
  cancelledAt?: Date | null;
  gracePeriodEnd?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class UserPlan extends Model<UserPlanAttributes> implements UserPlanAttributes {
  public id!: string;
  public userId!: string;
  public planId!: string;
  public status!: UserPlanStatus;
  public startDate!: Date;
  public endDate!: Date;
  public tokensFromPlan!: number;
  public tokensFromTopup!: number;
  public autoRenew!: boolean;
  public cancelledAt!: Date | null;
  public gracePeriodEnd!: Date | null;
  public metadata!: Record<string, unknown> | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserPlan.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE',
    },
    planId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'plans', key: 'id' },
    },
    status: {
      type: DataTypes.ENUM(
        'trial',
        'active',
        'overdue',
        'cancelled',
        'expired',
        'noplan'
      ),
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    tokensFromPlan: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    tokensFromTopup: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    autoRenew: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    gracePeriodEnd: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: 'UserPlan',
    tableName: 'user_plans',
    hooks: {
      beforeValidate(plan: UserPlan) {
        if (plan.startDate && plan.endDate && plan.endDate < plan.startDate) {
          throw new Error('endDate must be >= startDate');
        }
      },
      async beforeCreate(plan: UserPlan) {
        if (ACTIVE_STATUSES.includes(plan.status as (typeof ACTIVE_STATUSES)[number])) {
          const count = await UserPlan.count({
            where: {
              userId: plan.userId,
              status: { [Op.in]: ACTIVE_STATUSES },
            },
          });
          if (count > 0) {
            throw new Error('User can have only one active plan at a time');
          }
        }
      },
      async beforeUpdate(plan: UserPlan) {
        if (plan.changed('status') && ACTIVE_STATUSES.includes(plan.status as (typeof ACTIVE_STATUSES)[number])) {
          const count = await UserPlan.count({
            where: {
              userId: plan.userId,
              status: { [Op.in]: ACTIVE_STATUSES },
              id: { [Op.ne]: plan.id },
            },
          });
          if (count > 0) {
            throw new Error('User can have only one active plan at a time');
          }
        }
      },
    },
  }
);
