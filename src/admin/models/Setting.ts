import db from '../../../shared/config/database';
import { Model, DataTypes } from 'sequelize';

export interface SettingAttributes {
  id: number;
  imageCost: number;
  videoCost: number;
  systemPrompt: string;
  trialTokens: number;
  trialPeriodDays: number;
  subscriptionGracePeriodDays: number;
}

export class Setting extends Model<SettingAttributes> implements SettingAttributes {
  public id!: number;
  public imageCost!: number;
  public videoCost!: number;
  public systemPrompt!: string;
  public trialTokens!: number;
  public trialPeriodDays!: number;
  public subscriptionGracePeriodDays!: number;
}

Setting.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    imageCost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 15 },
    videoCost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 40 },
    systemPrompt: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    trialTokens: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 50 },
    trialPeriodDays: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 7 },
    subscriptionGracePeriodDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 3,
    },
  },
  { sequelize: db, modelName: 'Setting', tableName: 'settings', timestamps: false }
);