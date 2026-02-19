import db from '../../../shared/config/database';
import { Model, DataTypes } from 'sequelize';

// --- Payment Model Attributes ---
export interface PaymentAttributes {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  paymentMethod: string;
  paymentProvider?: 'bepaid';
  externalPaymentId?: string;
  paymentToken?: string;
  redirectUrl?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

// --- Payment Model Class ---
export class Payment
  extends Model<PaymentAttributes>
  implements PaymentAttributes
{
  public id!: string;
  public userId!: string;
  public amount!: number;
  public currency!: string;
  public status!: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  public paymentMethod!: string;
  public paymentProvider?: 'bepaid';
  public externalPaymentId?: string;
  public paymentToken?: string;
  public redirectUrl?: string;
  public description?: string;
  public metadata?: Record<string, any>;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// --- Initialize Payment Model ---
Payment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'RUB',
    },
    status: {
      type: DataTypes.ENUM(
        'pending',
        'completed',
        'failed',
        'refunded',
        'cancelled'
      ),
      allowNull: false,
      defaultValue: 'pending',
    },
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    paymentProvider: {
      type: DataTypes.ENUM('bepaid'),
      allowNull: true,
    },
    externalPaymentId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    paymentToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    redirectUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: 'Payment',
    tableName: 'payments',
  }
);
