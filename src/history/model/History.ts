import db from "../../../shared/config/database";
import { Model, DataTypes } from "sequelize";

export interface HistoryAttributes {
    id: string;
    userId: string;
    service: "kling" | "higgsfield" | "gpt" | "nano" | "replicate";
    serviceTaskId?: string;
    status: "pending" | "processing" | "completed" | "failed";
    resultUrl?: string;
    prompt?: string;
    tokensSpent: number;
    errorMessage?: string;
    metadata?: Record<string, any>;
    createdAt?: Date;
    updatedAt?: Date;
}

export class History
    extends Model<HistoryAttributes>
    implements HistoryAttributes {
    public id!: string;
    public userId!: string;
    public service!: "kling" | "higgsfield" | "gpt" | "nano" | "replicate";
    public serviceTaskId?: string;
    public status!: "pending" | "processing" | "completed" | "failed";
    public resultUrl?: string;
    public prompt?: string;
    public tokensSpent!: number;
    public errorMessage?: string;
    public metadata?: Record<string, any>;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

History.init(
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
                model: "users",
                key: "id",
            },
        },
        service: {
            type: DataTypes.ENUM("kling", "higgsfield", "gpt", "nano", "replicate"),
            allowNull: false,
        },
        serviceTaskId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM("pending", "processing", "completed", "failed"),
            allowNull: false,
            defaultValue: "pending",
        },
        resultUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        prompt: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        tokensSpent: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        errorMessage: {
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
        modelName: "History",
        tableName: "generation_history",
    },
);