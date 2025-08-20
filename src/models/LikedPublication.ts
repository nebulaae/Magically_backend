import db from '../config/database';
import { DataTypes, Model } from 'sequelize';

export interface LikedPublicationAttributes {
    userId: string;
    publicationId: string;
}

export class LikedPublication extends Model<LikedPublicationAttributes> implements LikedPublicationAttributes {
    public userId!: string;
    public publicationId!: string;
}

LikedPublication.init(
    {
        userId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        publicationId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'publications',
                key: 'id',
            },
        },
    },
    {
        sequelize: db,
        modelName: 'LikedPublication',
        tableName: 'liked_publications',
        timestamps: false,
    }
);