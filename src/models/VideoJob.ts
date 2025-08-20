import db from '../config/database';
import { Model, DataTypes } from 'sequelize';

export interface VideoJobAttributes {
    id: string;
    userId: string;
    service: 'kling' | 'higgsfield';
    serviceTaskId: string;
    status: 'pending' | 'completed' | 'failed';
    videoUrl?: string;
    prompt?: string;
    errorMessage?: string;
}

export class VideoJob extends Model<VideoJobAttributes> implements VideoJobAttributes {
    public id!: string;
    public userId!: string;
    public service!: 'kling' | 'higgsfield';
    public serviceTaskId!: string;
    public status!: 'pending' | 'completed' | 'failed';
    public videoUrl?: string;
    public prompt?: string;
    public errorMessage?: string;
}

VideoJob.init(
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
            type: DataTypes.ENUM('kling', 'higgsfield'),
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
        videoUrl: {
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
        modelName: 'VideoJob',
        tableName: 'video_jobs',
    }
);