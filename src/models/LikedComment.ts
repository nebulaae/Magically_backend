import db from '../config/database';
import { DataTypes, Model } from 'sequelize';

export interface LikedCommentAttributes {
    userId: string;
    commentId: string;
}

export class LikedComment extends Model<LikedCommentAttributes> implements LikedCommentAttributes {
    public userId!: string;
    public commentId!: string;
}

LikedComment.init(
    {
        userId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        commentId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'comments',
                key: 'id',
            },
        },
    },
    {
        sequelize: db,
        modelName: 'LikedComment',
        tableName: 'liked_comments',
        timestamps: false,
    }
);
