import db from '../../../shared/config/database';
import { Model, DataTypes } from 'sequelize';

export interface TransactionAttributes {
  id: string;
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Transaction
  extends Model<TransactionAttributes>
  implements TransactionAttributes
{
  public id!: string;
  public userId!: string;
  public amount!: number;
  public type!: 'credit' | 'debit';
  public description!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Transaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    amount: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.ENUM('credit', 'debit'), allowNull: false },
    description: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize: db,
    modelName: 'Transaction',
    tableName: 'transactions',
  }
);
