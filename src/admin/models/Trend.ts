import db from '../../../shared/config/database';
import { Model, DataTypes } from 'sequelize';
import type { Admin } from './Admin';

export interface TrendAttributes {
  id: string;
  content: string;
  coverText?: string;
  trendingCover?: string;
  trendingImageSet?: string[];
  adminId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Trend extends Model<TrendAttributes> implements TrendAttributes {
  public id!: string;
  public content!: string;
  public coverText?: string;
  public trendingCover?: string;
  public trendingImageSet?: string[];
  public adminId?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Trend.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    coverText: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    trendingCover: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    trendingImageSet: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'Admins', key: 'id' },
    },
  },
  {
    sequelize: db,
    modelName: 'Trend',
    tableName: 'trends',
  }
);
