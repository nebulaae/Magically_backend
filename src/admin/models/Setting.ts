import db from '../../../shared/config/database';
import { Model, DataTypes } from 'sequelize';

export interface SettingAttributes {
    id: number;
    imageCost: number;
    videoCost: number;
    systemPrompt: string;
}

export class Setting extends Model<SettingAttributes> implements SettingAttributes {
    public id!: number;
    public imageCost!: number;
    public videoCost!: number;
    public systemPrompt!: string;
}

Setting.init(
    {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        imageCost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 15 },
        videoCost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 40 },
        systemPrompt: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    },
    { sequelize: db, modelName: 'Setting', tableName: 'settings', timestamps: false }
);