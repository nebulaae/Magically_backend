import db from '../config/database';
import type { User } from './User';
import { Model, DataTypes, BelongsToGetAssociationMixin } from 'sequelize';

// --- Gallery Model Attributes ---
export interface GalleryAttributes {
    id: string;
    userId: string;
    prompt: string;
    imageUrl: string;
    generationType: string;
    createdAt?: Date;
    updatedAt?: Date;
}

// --- Gallery Model Class ---
export class Gallery extends Model<GalleryAttributes> implements GalleryAttributes {
    public id!: string;
    public userId!: string;
    public prompt!: string;
    public imageUrl!: string;
    public generationType!: string;

    // Timestamps
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    // Associations
    public getUser!: BelongsToGetAssociationMixin<User>;
}

// --- Initialize Gallery Model ---
Gallery.init(
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
        prompt: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        generationType: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    },
    {
        sequelize: db,
        modelName: 'Gallery',
        tableName: 'galleries',
    }
);