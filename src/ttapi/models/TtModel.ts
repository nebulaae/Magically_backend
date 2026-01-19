import db from "../../../shared/config/database";
import { Model, DataTypes } from "sequelize";

export interface TtModelAttributes {
    id: string;
    userId: string;
    name: string;
    description?: string;
    instruction?: string;
    imagePaths: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

export class TtModel extends Model<TtModelAttributes> implements TtModelAttributes {
    public id!: string;
    public userId!: string;
    public name!: string;
    public description?: string;
    public instruction?: string;
    public imagePaths!: string[];

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

TtModel.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        userId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "users", key: "id" },
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        instruction: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        imagePaths: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
            validate: {
                isArrayValidator(value: string[]) {
                    if (!Array.isArray(value)) {
                        throw new Error('imagePaths must be an array');
                    }
                }
            }
        },
    },
    {
        sequelize: db,
        modelName: "TtModel",
        tableName: "tt_models",
    }
);