import express from "express";

import { User } from "../models/User";
import { Comment } from "../models/Comment";

// Manages daily actions and awards tokens atomically.
export const handleUserAction = async (user: User, tokenAmount: number, t: any) => {
    const now = new Date();
    // It's crucial to use the user object from the transaction to avoid stale data
    const lastReset = new Date(user.dailyActions.lastReset);

    // Reset daily action count if it's a new day (UTC)
    if (now.getUTCFullYear() > lastReset.getUTCFullYear() ||
        now.getUTCMonth() > lastReset.getUTCMonth() ||
        now.getUTCDate() > lastReset.getUTCDate()) {
        user.dailyActions = { count: 0, lastReset: now };
    }

    if (user.dailyActions.count < 10) { // Limit to 10 rewarded actions per day
        user.tokens += tokenAmount;
        user.dailyActions.count += 1;
        // The save will be committed with the transaction
        await user.save({ transaction: t });
    }
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