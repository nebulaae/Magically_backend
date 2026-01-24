import db from "../../../shared/config/database";
import { Model, DataTypes } from "sequelize";

export type ModelProvider = "unifically" | "ttapi";

export interface TrainingModelAttributes {
    id: string;
    userId: string;
    name: string;
    description?: string;
    instruction?: string;
    imagePaths: string[];
    provider: ModelProvider; // Провайдер модели
    createdAt?: Date;
    updatedAt?: Date;
}

export class TrainingModel extends Model<TrainingModelAttributes> implements TrainingModelAttributes {
    public id!: string;
    public userId!: string;
    public name!: string;
    public description?: string;
    public instruction?: string;
    public imagePaths!: string[];
    public provider!: ModelProvider;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

TrainingModel.init(
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
                        throw new Error("imagePaths must be an array");
                    }
                },
            },
        },
        provider: {
            type: DataTypes.ENUM("unifically", "ttapi"),
            allowNull: false,
            defaultValue: "unifically",
        },
    },
    {
        sequelize: db,
        modelName: "TrainingModel",
        tableName: "training_models",
    }
);