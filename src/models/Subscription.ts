import db from '../config/database';

import { DataTypes, Model } from 'sequelize';

// --- Subscription Model Attributes (Join Table) ---
export interface SubscriptionAttributes {
    followerId: string;
    followingId: string;
}

// --- Subscription Model Class ---
export class Subscription extends Model<SubscriptionAttributes> implements SubscriptionAttributes {
    public followerId!: string;
    public followingId!: string;
}

// --- Initialize Subscription Model ---
Subscription.init(
    {
        followerId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        followingId: {
            type: DataTypes.UUID,
            primaryKey: true,
            references: {
                model: 'users',
                key: 'id',
            },
        },
    },
    {
        sequelize: db,
        modelName: 'Subscription',
        tableName: 'subscriptions',
        timestamps: false, // No createdAt/updatedAt for a join table
    }
);
