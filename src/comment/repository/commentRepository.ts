import { Comment } from "../models/Comment";
import { Publication } from "../../publication/models/Publication";
import { User } from "../../user/models/User";
import { LikedComment } from "../models/LikedComment";
import { Transaction } from "sequelize";

export const createComment = (
  data: Partial<Comment>,
  transaction: Transaction,
) => {
  return Comment.create(data, { transaction });
};

export const findCommentById = (commentId: string) => {
  return Comment.findByPk(commentId);
};

export const findPublicationById = (publicationId: string) => {
  return Publication.findByPk(publicationId);
};

export const findTopLevelCommentsByPublicationId = (publicationId: string) => {
  return Comment.findAll({
    where: { publicationId, parentId: null },
    include: [
      {
        model: User,
        as: "author",
        attributes: ["id", "username", "fullname", "avatar"],
      },
    ],
    order: [["createdAt", "ASC"]],
  });
};

export const findRepliesByParentId = (parentId: string) => {
  return Comment.findAll({
    where: { parentId },
    include: [
      {
        model: User,
        as: "author",
        attributes: ["id", "username", "fullname", "avatar"],
      },
    ],
    order: [["createdAt", "ASC"]],
  });
};

export const updateCommentText = (comment: Comment, text: string) => {
  comment.text = text;
  return comment.save();
};

export const deleteComment = (comment: Comment, transaction: Transaction) => {
  return comment.destroy({ transaction });
};

export const countReplies = (parentId: string, transaction: Transaction) => {
  return Comment.count({
    where: { parentId: parentId },
    transaction,
  });
};

export const findUserById = (userId: string) => {
  return User.findByPk(userId);
};

export const createLikedComment = (
  userId: string,
  commentId: string,
  transaction: Transaction,
) => {
  return LikedComment.create({ userId, commentId }, { transaction });
};

export const deleteLikedComment = (
  userId: string,
  commentId: string,
  transaction: Transaction,
) => {
  return LikedComment.destroy({ where: { userId, commentId }, transaction });
};
