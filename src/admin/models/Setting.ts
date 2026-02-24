import db from '../../../shared/config/database';
import { Model, DataTypes } from 'sequelize';

export interface SettingAttributes {
  id: number;
  imageCost: number;
  videoCost: number;
  systemPrompt: string;
  aiCost1K: number;
  aiCost2K: number;
}

export class Setting
  extends Model<SettingAttributes>
  implements SettingAttributes {
  public id!: number;
  public imageCost!: number;
  public videoCost!: number;
  public systemPrompt!: string;
  public aiCost1K!: number;
  public aiCost2K!: number;
}

Setting.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    imageCost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 15 },
    videoCost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 40 },
    systemPrompt: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    aiCost1K: { type: DataTypes.INTEGER, defaultValue: 15 },
    aiCost2K: { type: DataTypes.INTEGER, defaultValue: 20 },
  },
  {
    sequelize: db,
    modelName: 'Setting',
    tableName: 'settings',
    timestamps: false,
  }
);
