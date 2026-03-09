import { DataTypes, Model } from 'sequelize';
import db from '../../../shared/config/database';

export interface EmailLogAttributes {
  id: string;
  userId?: string | null;
  email: string;
  type: string;
  meta?: Record<string, unknown> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class EmailLog
  extends Model<EmailLogAttributes>
  implements EmailLogAttributes
{
  public id!: string;
  public userId!: string | null;
  public email!: string;
  public type!: string;
  public meta!: Record<string, unknown> | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

EmailLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    meta: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    modelName: 'EmailLog',
    tableName: 'email_logs',
    indexes: [
      { fields: ['userId'] },
      { fields: ['email'] },
      { fields: ['type'] },
    ],
  }
);

