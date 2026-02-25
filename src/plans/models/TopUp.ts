import db from '../../../shared/config/database';
import { Model, DataTypes } from 'sequelize';

export interface TopUpAttributes {
  id: string;
  userId: string;
  userPlanId: string;
  tokenAmount: number;
  price: number;
  currency: string;
  paymentId?: string | null;
  expiresAt: Date;
  createdAt?: Date;
}

export class TopUp extends Model<TopUpAttributes> implements TopUpAttributes {
  public id!: string;
  public userId!: string;
  public userPlanId!: string;
  public tokenAmount!: number;
  public price!: number;
  public currency!: string;
  public paymentId!: string | null;
  public expiresAt!: Date;
  public readonly createdAt!: Date;
}

TopUp.init(
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
    userPlanId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'user_plans', key: 'id' },
      onDelete: 'CASCADE',
    },
    tokenAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
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
    paymentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'payments', key: 'id' },
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize: db,
    modelName: 'TopUp',
    tableName: 'topups',
    timestamps: true,
    updatedAt: false,
  }
);
