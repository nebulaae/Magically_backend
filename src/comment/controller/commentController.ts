import { Request, Response } from "express";
import * as commentService from "../service/commentService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import logger from "../../../shared/utils/logger";

export const createComment = async (req: Request, res: Response) => {
  try {
    const { publicationId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    if (!text) {
      return apiResponse.badRequest(res, "Comment text cannot be empty.");
    }
    const comment = await commentService.createComment(
      userId,
      publicationId,
      text,
    );
    apiResponse.success(res, comment, "Comment created.", 201);
  } catch (error) {
    logger.error(`Create comment error: ${error.message}`);
    apiResponse.internalError(res, error.message);
  }
};

export const replyToComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    if (!text) {
      return apiResponse.badRequest(res, "Reply text cannot be empty.");
    }
    const reply = await commentService.replyToComment(userId, commentId, text);
    apiResponse.success(res, reply, "Reply created.", 201);
  } catch (error) {
    logger.error(`Reply to comment error: ${error.message}`);
    apiResponse.internalError(res, error.message);
  }
};

export const getCommentsForPublication = async (
  req: Request,
  res: Response,
) => {
  try {
    const { publicationId } = req.params;
    // pass current user id when available so service can mark isLiked per comment
    const userId = req.user && (req.user as any).id;
    const comments = await commentService.getCommentsForPublication(
      publicationId,
      userId,
    );
    apiResponse.success(res, comments);
  } catch (error) {
    logger.error(`Get comments error: ${error.message}`);
    apiResponse.internalError(res, "Server error while fetching comments.");
  }
};

export const updateComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;
    const comment = await commentService.updateComment(commentId, userId, text);
    apiResponse.success(res, comment, "Comment updated.");
  } catch (error) {
    logger.error(`Update comment error: ${error.message}`);
    if (error.message.includes("not authorized")) {
      return apiResponse.forbidden(res, error.message);
    }
    apiResponse.internalError(res, error.message);
  }
};

export const deleteComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const result = await commentService.deleteComment(commentId, userId);
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Delete comment error: ${error.message}`);
    if (error.message.includes("not authorized")) {
      return apiResponse.forbidden(res, error.message);
    }
    apiResponse.internalError(res, error.message);
  }
};

export const likeComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const result = await commentService.likeComment(commentId, userId);
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Like comment error: ${error.message}`);
    if (error.name === "SequelizeUniqueConstraintError") {
      return apiResponse.conflict(res, "You have already liked this comment.");
    }
    apiResponse.internalError(res, error.message);
  }
};

export const unlikeComment = async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const result = await commentService.unlikeComment(commentId, userId);
    apiResponse.success(res, null, result.message);
  } catch (error) {
    logger.error(`Unlike comment error: ${error.message}`);
    if (error.message === "You have not liked this comment.") {
      return apiResponse.conflict(res, error.message);
    }
    apiResponse.internalError(res, error.message);
  }
};
