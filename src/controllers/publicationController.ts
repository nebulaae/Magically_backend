import db from '../config/database';

import { Op } from 'sequelize';
import { User } from '../models/User';
import { Comment } from '../models/Comment';
import { Request, Response } from 'express';
import { Publication } from '../models/Publication';
import { Subscription } from '../models/Subscription';
import { LikedPublication } from '../models/LikedPublication';
import { fetchReplies, handleUserAction } from '../lib/utils';

// --- Get Single Publication by ID with full comment tree ---
export const getPublicationById = async (req: Request, res: Response) => {
    try {
        const { publicationId } = req.params;
        const userId = req.user.id;

        const publication = await Publication.findByPk(publicationId, {
            include: [
                {
                    model: User,
                    as: 'author',
                    attributes: ['id', 'username', 'fullname', 'avatar']
                }
            ],
        });

        if (!publication) {
            return res.status(404).json({ message: 'Publication not found' });
        }

        const topLevelComments = await Comment.findAll({
            where: { publicationId: publication.id, parentId: null },
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullname', 'avatar'] }],
            order: [['createdAt', 'ASC']],
        });
        for (const comment of topLevelComments) {
            (comment as any).dataValues.replies = await fetchReplies(comment);
        }

        const publicationJson = publication.toJSON();
        const isFollowing = await Subscription.findOne({ where: { followerId: userId, followingId: publication.userId } });
        const isLiked = await LikedPublication.findOne({ where: { userId, publicationId: publication.id } });

        const publicationWithExtras = {
            ...publicationJson,
            isFollowing: !!isFollowing,
            isLiked: !!isLiked,
            comments: topLevelComments // Include comments directly
        };

        res.json(publicationWithExtras);
    } catch (error) {
        console.error('Get publication by ID error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- The rest of the publication controller remains largely the same ---
const addExtraInfoToPublications = async (publications: Publication[], userId: string) => {
    if (publications.length === 0) return [];
    const authorIds = publications.map(p => p.userId);
    const publicationIds = publications.map(p => p.id);

    const following = await Subscription.findAll({
        where: { followerId: userId, followingId: { [Op.in]: authorIds } },
    });
    const followingIds = new Set(following.map(sub => sub.followingId));

    const liked = await LikedPublication.findAll({
        where: { userId, publicationId: { [Op.in]: publicationIds } },
    });
    const likedPublicationIds = new Set(liked.map(like => like.publicationId));

    return publications.map(p => {
        const publicationJson = p.toJSON();
        return {
            ...publicationJson,
            isFollowing: followingIds.has(p.userId),
            isLiked: likedPublicationIds.has(p.id),
        };
    });
};

export const createPublication = async (req: Request, res: Response) => {
    try {
        const { content } = req.body;
        const userId = req.user.id;
        let imageUrl: string | undefined;

        if (req.file) {
            imageUrl = `/publications/${req.file.filename}`;
        }

        if (!content && !imageUrl) {
            return res.status(400).json({ message: 'Publication must have content or an image.' });
        }


        const publication = await Publication.create({
            userId,
            content,
            imageUrl,
            category: "Not defined",
            likeCount: 0,
            commentCount: 0
        });

        res.status(201).json({ message: 'Publication created successfully', publication });
    } catch (error) {
        console.error('Create publication error:', error);
        res.status(500).json({ message: 'Server error during publication creation' });
    }
};

// GET /api/publications - Get All Publications with Pagination and Filtering
export const getAllPublications = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { page = '1', limit = '10', sortBy, hashtag } = req.query;

        const pageNumber = parseInt(page as string, 10);
        const limitNumber = parseInt(limit as string, 10);
        const offset = (pageNumber - 1) * limitNumber;

        let order: any = [['createdAt', 'DESC']];
        if (sortBy === 'popular') {
            order = [['likeCount', 'DESC']];
        } else if (sortBy === 'oldest') {
            order = [['createdAt', 'ASC']];
        }

        let whereClause: any = {};
        if (hashtag && typeof hashtag === 'string') {
            // Search for content that contains the hashtag
            whereClause.content = { [Op.iLike]: `%#${hashtag}%` };
        }

        const { count, rows: publications } = await Publication.findAndCountAll({
            where: whereClause,
            order: order,
            limit: limitNumber,
            offset: offset,
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullname', 'avatar'] }]
        });

        const publicationsWithInfo = await addExtraInfoToPublications(publications, userId);

        res.json({
            publications: publicationsWithInfo,
            nextPage: count > pageNumber * limitNumber ? pageNumber + 1 : undefined,
        });

    } catch (error) {
        console.error('Get all publications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const updatePublication = async (req: Request, res: Response) => {
    try {
        const { publicationId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;

        const publication = await Publication.findByPk(publicationId);
        if (!publication) return res.status(404).json({ message: 'Publication not found' });
        if (publication.userId !== userId) return res.status(403).json({ message: 'You are not authorized to edit this publication' });

        publication.content = content || publication.content;
        await publication.save();

        res.json({ message: 'Publication updated successfully', publication });
    } catch (error) {
        console.error('Update publication error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const likePublication = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { publicationId } = req.params;

        const publication = await Publication.findByPk(publicationId);
        if (!publication) return res.status(404).json({ message: 'Publication not found' });

        const user = await User.findByPk(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await db.transaction(async (t) => {
            await LikedPublication.create({ userId, publicationId }, { transaction: t });
            await publication.increment('likeCount', { transaction: t });
            if (publication.category) {
                const currentInterests = user.interests || [];
                if (!currentInterests.includes(publication.category)) {
                    user.interests = [...currentInterests, publication.category];
                    await user.save({ transaction: t });
                }
            }
            await handleUserAction(user, 10, t);
        });

        res.status(200).json({ message: 'Publication liked successfully' });
    } catch (error) {
        console.error('Like publication error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') return res.status(409).json({ message: 'You have already liked this publication.' });
        res.status(500).json({ message: 'Server error' });
    }
};

export const unlikePublication = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { publicationId } = req.params;

        const publication = await Publication.findByPk(publicationId);
        if (!publication) return res.status(404).json({ message: 'Publication not found' });

        await db.transaction(async (t) => {
            const result = await LikedPublication.destroy({ where: { userId, publicationId }, transaction: t });
            if (result === 0) throw new Error("Not liked");
            if (publication.likeCount > 0) {
                await publication.decrement('likeCount', { transaction: t });
            }
        });

        res.status(200).json({ message: 'Publication unliked successfully' });
    } catch (error) {
        if (error.message === 'Not liked') return res.status(404).json({ message: 'You have not liked this publication.' });
        console.error('Unlike publication error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getMyLikedPublications = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);

        if (!user) return res.status(404).json({ message: 'User not found' });
        const likedPublications = await user.getLikedPublications({
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullname', 'avatar'] }],
            order: [['createdAt', 'DESC']]
        });

        const publicationsWithInfo = await addExtraInfoToPublications(likedPublications, userId);

        res.json(publicationsWithInfo);
    } catch (error) {
        console.error('Get liked publications error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/publications/:publicationId - Delete a Publication
export const deletePublication = async (req: Request, res: Response) => {
    try {
        const { publicationId } = req.params;
        const userId = req.user.id;

        const publication = await Publication.findByPk(publicationId);
        if (!publication) {
            return res.status(404).json({ message: 'Publication not found' });
        }

        if (publication.userId !== userId) {
            return res.status(403).json({ message: 'You are not authorized to delete this publication' });
        }

        await publication.destroy();
        res.status(200).json({ message: 'Publication deleted successfully.' });
    } catch (error) {
        console.error('Delete publication error:', error);
        res.status(500).json({ message: 'Server error while deleting publication.' });
    }
};