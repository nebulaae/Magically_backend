import db from '../config/database';
import type { User } from './User';
import type { Comment } from './Comment';
import {
    Model,
    DataTypes,
    BelongsToManyAddAssociationMixin,
    BelongsToManyGetAssociationsMixin,
    BelongsToManyRemoveAssociationMixin,
    HasManyGetAssociationsMixin,
} from 'sequelize';

// --- Publication Model Attributes ---
export interface PublicationAttributes {
    id: string;
    userId: string;
    content: string;
    imageUrl?: string;
    videoUrl?: string; // [NEW] For video content
    category?: string;
    likeCount: number;
    commentCount: number;
    createdAt?: Date;
    updatedAt?: Date;
}

// --- Publication Model Class ---
export class Publication extends Model<PublicationAttributes> implements PublicationAttributes {
    public id!: string;
    public userId!: string;
    public content!: string;
    public imageUrl?: string;
    public videoUrl?: string; // [NEW]
    public category?: string;
    public likeCount!: number;
    public commentCount!: number;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    // Associations
    public getLikers!: BelongsToManyGetAssociationsMixin<User>;
    public addLiker!: BelongsToManyAddAssociationMixin<User, string>;
    public removeLiker!: BelongsToManyRemoveAssociationMixin<User, string>;
    public getComments!: HasManyGetAssociationsMixin<Comment>;
}

// --- Initialize Publication Model ---
Publication.init(
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
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        videoUrl: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        category: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        likeCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        commentCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    },
    {
        sequelize: db,
        modelName: 'Publication',
        tableName: 'publications',
    }
);