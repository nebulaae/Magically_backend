import db from '../config/database';
import { Model, DataTypes } from 'sequelize';

export interface GenerationJobAttributes {
    id: string;
    userId: string;
    service: 'kling' | 'higgsfield' | 'gpt' | 'fal' | 'replicate';
    serviceTaskId: string;
    status: 'pending' | 'completed' | 'failed';
    resultUrl?: string;
    prompt?: string;
    errorMessage?: string;
}

export class GenerationJob extends Model<GenerationJobAttributes> implements GenerationJobAttributes {
    public id!: string;
    public userId!: string;
    public service!: 'kling' | 'higgsfield' | 'gpt' | 'fal' | 'replicate';
    public serviceTaskId!: string;
    public status!: 'pending' | 'completed' | 'failed';
    public resultUrl?: string;
    public prompt?: string;
    public errorMessage?: string;
}

GenerationJob.init(
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
        service: {
            type: DataTypes.ENUM('kling', 'higgsfield', 'gpt', 'fal', 'replicate'),
            allowNull: false,
        },
        serviceTaskId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed'),
            allowNull: false,
            defaultValue: 'pending',
        },
        resultUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        prompt: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        errorMessage: {
            type: DataTypes.TEXT,
            allowNull: true,
        }
    },
    {
        sequelize: db,
        modelName: 'GenerationJob',
        tableName: 'generation_jobs',
    }
);