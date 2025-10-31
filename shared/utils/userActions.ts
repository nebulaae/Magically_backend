import logger from "./logger";
import { Transaction } from "sequelize";
import { User } from "../../src/user/models/User";
import { Comment } from "../../src/comment/models/Comment";
import { LikedComment } from "../../src/comment/models/LikedComment";

// Manages daily actions and awards tokens atomically.
export const handleUserAction = async (
  user: User,
  tokenAmount: number,
  t: Transaction,
) => {
  const now = new Date();
  // It's crucial to use the user object from the transaction to avoid stale data
  const lastReset = new Date(user.dailyActions.lastReset);

  // Create date objects with only year, month, and day for accurate comparison
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const lastResetDay = new Date(
    Date.UTC(
      lastReset.getUTCFullYear(),
      lastReset.getUTCMonth(),
      lastReset.getUTCDate(),
    ),
  );

  let currentCount = user.dailyActions.count;
  let currentLastReset = user.dailyActions.lastReset;

  // Check if the reset day is in the past
  if (today > lastResetDay) {
    console.log(`Resetting daily actions for user ${user.id}. New day.`);
    currentCount = 0;
    currentLastReset = now; // Set reset time to now
  }

  if (currentCount < 10) {
    user.tokens += tokenAmount;

    // Always assign a new object for Sequelize JSONB to detect change
    user.dailyActions = {
      count: currentCount + 1,
      lastReset: currentLastReset, // Use the (potentially updated) reset date
    };

    await user.save({ transaction: t });
  } else {
    logger.info(`User ${user.id} has reached their daily action limit.`);
  }
};

// Deducts tokens for generation actions.
export const deductTokensForGeneration = async (
  userId: string,
  type: "image" | "video" | "training",
  t: Transaction,
) => {
  const user = await User.findByPk(userId, {
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
  if (!user) {
    throw new Error("User not found for token deduction.");
  }

  // Define costs - training a model is expensive
  let cost = 0;
  switch (type) {
    case "image":
      cost = 15;
      break;
    case "video":
      cost = 40;
      break;
    // Add a training cost, user used "video" cost for it
    case "training":
      cost = 150;
      break;
  }

  if (user.tokens < cost) {
    throw new Error("Insufficient tokens for this generation.");
  }

  user.tokens -= cost;
  await user.save({ transaction: t });
  logger.info(
    `Deducted ${cost} tokens from user ${userId}. Remaining: ${user.tokens}`,
  );
};

// Helper function to recursively fetch replies
export const fetchReplies = async (
  comment: Comment,
  userId: string, // [FIX] Pass userId to check likes on replies
) => {
  const replies = await Comment.findAll({
    where: { parentId: comment.id },
    include: [
      {
        model: User,
        as: "author",
        attributes: ["id", "username", "fullname", "avatar"],
      },
    ],
    order: [["createdAt", "ASC"]],
  });

  // [FIX] Check likes for replies
  const replyIds = replies.map((r) => r.id);
  const likedReplies = await LikedComment.findAll({
    where: { userId, commentId: replyIds },
  });
  const likedReplyIds = new Set(likedReplies.map((l) => l.commentId));

  for (const reply of replies) {
    (reply as any).dataValues.isLiked = likedReplyIds.has(reply.id);
    (reply as any).dataValues.replies = await fetchReplies(reply, userId);
  }
  return replies;
};
