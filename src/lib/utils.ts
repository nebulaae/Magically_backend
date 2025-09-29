import express from "express";

import { User } from "../models/User";
import { Transaction } from "sequelize";
import { Comment } from "../models/Comment";

// Helper to create consistent cache keys
export const createCacheKey = (req: express.Request) => {
    const { originalUrl } = req;
    const userId = req.user?.id || 'public'; // Differentiate cache for different users if needed
    return `${userId}:${originalUrl}`;
};

// Manages daily actions and awards tokens atomically.
export const handleUserAction = async (user: User, tokenAmount: number, t: Transaction) => {
    const now = new Date();
    // It's crucial to use the user object from the transaction to avoid stale data
    const lastReset = new Date(user.dailyActions.lastReset);
    // Create date objects with only year, month, and day for accurate comparison
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const lastResetDay = new Date(Date.UTC(lastReset.getUTCFullYear(), lastReset.getUTCMonth(), lastReset.getUTCDate()));

    let currentActions = user.dailyActions;

    if (today > lastResetDay) {
        console.log(`Resetting daily actions for user ${user.id}. New day.`);
        // Reset the actions for the new day
        currentActions = { count: 0, lastReset: now };
    }

    if (currentActions.count < 10) { // Limit to 10 rewarded actions per day
        user.tokens += tokenAmount;

        // FIX: Re-assign the entire object to ensure Sequelize detects the change.
        user.dailyActions = {
            count: currentActions.count + 1,
            lastReset: currentActions.lastReset
        };

        await user.save({ transaction: t });
    } else {
        console.log(`User ${user.id} has reached their daily action limit.`);
    }
};

// Deducts tokens for generation actions.
export const deductTokensForGeneration = async (userId: string, type: 'image' | 'video', t: Transaction) => {
    const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!user) {
        throw new Error("User not found for token deduction.");
    }

    const cost = type === 'image' ? 15 : 40;
    if (user.tokens < cost) {
        throw new Error("Insufficient tokens for this generation.");
    }

    user.tokens -= cost;
    await user.save({ transaction: t });
    console.log(`Deducted ${cost} tokens from user ${userId}. Remaining: ${user.tokens}`);
};


// Helper to wrap async route handlers
export const asyncHandler = (fn: any) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// Helper function to recursively fetch replies
export const fetchReplies = async (comment: Comment) => {
    const replies = await Comment.findAll({
        where: { parentId: comment.id },
        include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullname', 'avatar'] }],
        order: [['createdAt', 'ASC']]
    });
    for (const reply of replies) {
        (reply as any).dataValues.replies = await fetchReplies(reply);
    }
    return replies;
};

// --- Replicate Model Status Type ---
// FIX: Defined all possible statuses from the Replicate library to ensure type compatibility.
export type ReplicateStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
