import db from '../config/database';

import { User } from '../models/User';
import { Comment } from '../models/Comment';
import { Request, Response } from 'express';
import { Publication } from '../models/Publication';
import { fetchReplies, handleUserAction } from '../lib/utils';

// --- Create a Comment ---
export const createComment = async (req: Request, res: Response) => {
    try {
        const { publicationId } = req.params;
        const { text } = req.body;

        const userId = req.user.id;
        const me = await User.findByPk(userId);

        if (!text) {
            return res.status(400).json({ message: 'Comment text cannot be empty.' });
        }

        const publication = await Publication.findByPk(publicationId);
        if (!publication) {
            return res.status(404).json({ message: 'Publication not found.' });
        }

        let comment;
        await db.transaction(async (t) => {
            comment = await Comment.create({
                userId,
                publicationId,
                text,
            }, { transaction: t });

            await publication.increment('commentCount', { transaction: t });
            await handleUserAction(me, 20, t);
        });

        res.status(201).json(comment);
    } catch (error) {
        console.error('Create comment error:', error);
        res.status(500).json({ message: 'Server error while creating comment.' });
    }
};


// --- Reply to a Comment ---
export const replyToComment = async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        if (!text) {
            return res.status(400).json({ message: 'Reply text cannot be empty.' });
        }

        const parentComment = await Comment.findByPk(commentId);
        if (!parentComment) {
            return res.status(404).json({ message: 'Parent comment not found.' });
        }

        const publication = await Publication.findByPk(parentComment.publicationId);
        if (!publication) {
            return res.status(404).json({ message: 'Associated publication not found.' });
        }

        let reply: any;

        await db.transaction(async (t) => {
            reply = await Comment.create({
                userId,
                publicationId: parentComment.publicationId,
                text,
                parentId: commentId,
            }, { transaction: t });

            await publication.increment('commentCount', { transaction: t });
        });

        res.status(201).json(reply);

    } catch (error) {
        console.error('Reply to comment error:', error);
        res.status(500).json({ message: 'Server error while replying to comment.' });
    }
};

// --- Get Comments for a Publication ---
export const getCommentsForPublication = async (req: Request, res: Response) => {
    try {
        const { publicationId } = req.params;
        const topLevelComments = await Comment.findAll({
            where: { publicationId, parentId: null },
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullname', 'avatar'] }],
            order: [['createdAt', 'ASC']],
        });

        for (const comment of topLevelComments) {
            (comment as any).dataValues.replies = await fetchReplies(comment);
        }

        res.status(200).json(topLevelComments);
    } catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ message: 'Server error while fetching comments.' });
    }
};

// --- Update a Comment ---
export const updateComment = async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        const comment = await Comment.findByPk(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found.' });
        }

        if (comment.userId !== userId) {
            return res.status(403).json({ message: 'You are not authorized to edit this comment.' });
        }

        comment.text = text;
        await comment.save();

        res.status(200).json(comment);
    } catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json({ message: 'Server error while updating comment.' });
    }
};

// --- Delete a Comment ---
export const deleteComment = async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;

        const comment = await Comment.findByPk(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found.' });
        }

        if (comment.userId !== userId) {
            return res.status(403).json({ message: 'You are not authorized to delete this comment.' });
        }

        const publication = await Publication.findByPk(comment.publicationId);

        await db.transaction(async (t) => {
            // This will also delete all replies due to ON DELETE CASCADE
            await comment.destroy({ transaction: t });

            // Decrement publication's comment count if it exists
            if (publication && publication.commentCount > 0) {
                // Count replies to be deleted as well
                const replyCount = await Comment.count({ where: { parentId: commentId }, transaction: t });
                const totalDecrement = 1 + replyCount;

                if (publication.commentCount - totalDecrement >= 0) {
                    await publication.decrement('commentCount', { by: totalDecrement, transaction: t });
                } else {
                    publication.commentCount = 0;
                    await publication.save({ transaction: t });
                }
            }
        });

        res.status(200).json({ message: 'Comment deleted successfully.' });
    } catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ message: 'Server error while deleting comment.' });
    }
};

// --- Like a Comment ---
export const likeComment = async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;

        const comment = await Comment.findByPk(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found.' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await db.transaction(async (t) => {
            await user.addLikedComment(comment, { transaction: t });
            await comment.increment('likeCount', { transaction: t });
        });

        res.status(200).json({ message: 'Comment liked successfully.' });
    } catch (error) {
        console.error('Like comment error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'You have already liked this comment.' });
        }
        res.status(500).json({ message: 'Server error while liking comment.' });
    }
};

// --- Unlike a Comment ---
export const unlikeComment = async (req: Request, res: Response) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;

        const comment = await Comment.findByPk(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comment not found.' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        await db.transaction(async (t) => {
            const result = await user.removeLikedComment(comment, { transaction: t });
            if (result === null) {
                throw new Error("Not liked");
            }
            if (comment.likeCount > 0) {
                await comment.decrement('likeCount', { transaction: t });
            }
        });

        res.status(200).json({ message: 'Comment unliked successfully.' });
    } catch (error) {
        if (error.message === 'Not liked') {
            return res.status(404).json({ message: 'You have not liked this comment.' });
        }
        console.error('Unlike comment error:', error);
        res.status(500).json({ message: 'Server error while unliking comment.' });
    }
};