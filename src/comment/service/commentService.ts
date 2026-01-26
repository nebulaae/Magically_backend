import db from "../../../shared/config/database";
import * as commentRepository from "../repository/commentRepository";
import { handleUserAction } from "../../../shared/utils/userActions";
import {
  invalidateCache,
  getFromCache,
  setInCache,
} from "../../../shared/config/redis";
import { Comment } from "../models/Comment";

const fetchRepliesRecursive = async (comment: Comment) => { 
  const replies = await commentRepository.findRepliesByParentId(comment.id);
  for (const reply of replies) {
    (reply as any).dataValues.replies = await fetchRepliesRecursive(reply);
  }
  return replies;
};

export const createComment = async (
  userId: string,
  publicationId: string,
  text: string,
) => {
  const publication =
    await commentRepository.findPublicationById(publicationId);
  if (!publication) {
    throw new Error("Publication not found.");
  }

  const user = await commentRepository.findUserById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  let comment: Comment;
  await db.transaction(async (t) => {
    comment = await commentRepository.createComment(
      { userId, publicationId, text },
      t,
    );
    await publication.increment("commentCount", { transaction: t });
    await handleUserAction(user, 2, t);
  });

  await invalidateCache(`comments:publication:${publicationId}`);
  return comment;
};

export const replyToComment = async (
  userId: string,
  parentCommentId: string,
  text: string,
) => {
  const parentComment =
    await commentRepository.findCommentById(parentCommentId);
  if (!parentComment) {
    throw new Error("Parent comment not found.");
  }

  const publication = await commentRepository.findPublicationById(
    parentComment.publicationId,
  );
  if (!publication) {
    throw new Error("Associated publication not found.");
  }

  let reply: Comment;
  await db.transaction(async (t) => {
    reply = await commentRepository.createComment(
      {
        userId,
        publicationId: parentComment.publicationId,
        text,
        parentId: parentCommentId,
      },
      t,
    );
    await publication.increment("commentCount", { transaction: t });
  });

  await invalidateCache(`comments:publication:${parentComment.publicationId}`);
  return reply;
};

export const getCommentsForPublication = async (
  publicationId: string,
  userId?: string,
) => {
  const cacheKey = `comments:publication:${publicationId}`;
  const cachedData = await getFromCache<any>(cacheKey);

  // Helpers
  const collectIdsRecursive = (node: any, acc: string[]) => {
    if (!node) return;
    acc.push(node.id);
    const replies = node.dataValues ? node.dataValues.replies : node.replies;
    if (Array.isArray(replies)) {
      for (const r of replies) collectIdsRecursive(r, acc);
    }
  };

  if (cachedData) {
    // cachedData is the neutral (no user overlay) plain JSON stored in cache.
    if (!userId) return cachedData;

    // clone cached data to avoid mutating shared cache
    const clone = JSON.parse(JSON.stringify(cachedData));
    const allIds: string[] = [];
    for (const c of clone) collectIdsRecursive(c, allIds);

    const likedIds = await commentRepository.findLikedCommentIdsByUserAndCommentIds(
      userId,
      allIds,
    );
    const likedSet = new Set(likedIds || []);

    const overlayRecursive = (node: any) => {
      if (!node) return;
      node.isLiked = likedSet.has(node.id);
      if (node.replies && Array.isArray(node.replies)) {
        for (const r of node.replies) overlayRecursive(r);
      }
    };

    for (const c of clone) overlayRecursive(c);
    return clone;
  }

  // No cache: fetch fresh from DB
  const topLevelComments =
    await commentRepository.findTopLevelCommentsByPublicationId(publicationId);

  for (const comment of topLevelComments) {
    (comment as any).dataValues.replies = await fetchRepliesRecursive(comment);
  }

  // Cache neutral plain version (without user overlay)
  const plainToCache = topLevelComments.map((c: any) => c.get({ plain: true }));
  await setInCache(cacheKey, plainToCache, 300);

  // If userId provided, overlay isLiked on model instances
  if (userId) {
    const allIds: string[] = [];
    for (const c of topLevelComments) collectIdsRecursive(c, allIds);
    const likedIds = await commentRepository.findLikedCommentIdsByUserAndCommentIds(
      userId,
      allIds,
    );
    const likedSet = new Set(likedIds || []);

    const applyRecursive = (node: any) => {
      if (!node) return;
      if (node.dataValues) node.dataValues.isLiked = likedSet.has(node.id);
      else node.isLiked = likedSet.has(node.id);
      const replies = node.dataValues ? node.dataValues.replies : node.replies;
      if (Array.isArray(replies)) {
        for (const r of replies) applyRecursive(r);
      }
    };

    for (const c of topLevelComments) applyRecursive(c);
  }

  return topLevelComments;
};

export const updateComment = async (
  commentId: string,
  userId: string,
  text: string,
) => {
  const comment = await commentRepository.findCommentById(commentId);
  if (!comment) {
    throw new Error("Comment not found.");
  }

  if (comment.userId !== userId) {
    throw new Error("You are not authorized to edit this comment.");
  }

  const updatedComment = await commentRepository.updateCommentText(
    comment,
    text,
  );
  await invalidateCache(`comments:publication:${comment.publicationId}`);
  return updatedComment;
};

export const deleteComment = async (commentId: string, userId: string) => {
  const comment = await commentRepository.findCommentById(commentId);
  if (!comment) {
    throw new Error("Comment not found.");
  }

  if (comment.userId !== userId) {
    throw new Error("You are not authorized to delete this comment.");
  }

  const publication = await commentRepository.findPublicationById(
    comment.publicationId,
  );

  await db.transaction(async (t) => {
    const replyCount = await commentRepository.countReplies(commentId, t);
    const totalDecrement = 1 + replyCount;
    await commentRepository.deleteComment(comment, t);

    if (publication && publication.commentCount > 0) {
      if (publication.commentCount - totalDecrement >= 0) {
        await publication.decrement("commentCount", {
          by: totalDecrement,
          transaction: t,
        });
      } else {
        publication.commentCount = 0;
        await publication.save({ transaction: t });
      }
    }
  });

  await invalidateCache(`comments:publication:${comment.publicationId}`);
  return { message: "Comment deleted successfully." };
};

export const likeComment = async (commentId: string, userId: string) => {
  const comment = await commentRepository.findCommentById(commentId);
  if (!comment) {
    throw new Error("Comment not found.");
  }

  const user = await commentRepository.findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  await db.transaction(async (t) => {
    await commentRepository.createLikedComment(userId, commentId, t);
    await comment.increment("likeCount", { transaction: t });
  });

  await invalidateCache(`comments:publication:${comment.publicationId}`);
  return { message: "Comment liked successfully." };
};

export const unlikeComment = async (commentId: string, userId: string) => {
  const comment = await commentRepository.findCommentById(commentId);
  if (!comment) {
    throw new Error("Comment not found.");
  }

  const user = await commentRepository.findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  await db.transaction(async (t) => {
    const result = await commentRepository.deleteLikedComment(
      userId,
      commentId,
      t,
    );
    if (result === 0) {
      throw new Error("You have not liked this comment.");
    }
    if (comment.likeCount > 0) {
      await comment.decrement("likeCount", { transaction: t });
    }
  });

  await invalidateCache(`comments:publication:${comment.publicationId}`);
  return { message: "Comment unliked successfully." };
};
