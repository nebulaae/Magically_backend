import db from '../../../shared/config/database';
import { Model, DataTypes } from 'sequelize';

export type PlanType = 'package' | 'subscription' | 'topup';

export interface PlanAttributes {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  type: PlanType;
  tokenAmount: number;
  periodDays: number | null;
  price: number;
  currency: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Plan extends Model<PlanAttributes> implements PlanAttributes {
  public id!: string;
  public name!: string;
  public description!: string | null;
  public icon!: string | null;
  public type!: PlanType;
  public tokenAmount!: number;
  public periodDays!: number | null;
  public price!: number;
  public currency!: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Plan.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    type: {
      type: DataTypes.ENUM('package', 'subscription', 'topup'),
      allowNull: false,
    },
    tokenAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
    },
    periodDays: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 },
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'RUB',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize: db,
    modelName: 'Plan',
    tableName: 'plans',
    hooks: {
      beforeValidate(plan: Plan) {
        if (plan.type === 'package' || plan.type === 'subscription') {
          if (plan.periodDays == null || plan.periodDays <= 0) {
            throw new Error('periodDays must be positive for package and subscription');
          }
        }
      },
    },
  }
);
