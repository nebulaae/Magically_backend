import { Op } from 'sequelize';
import { User } from '../models/User';
import { Request, Response } from 'express';
import { Publication } from '../models/Publication';
import { Subscription } from '../models/Subscription';

// Helper to add 'isFollowing' info to users
const addIsFollowingInfoToUsers = async (users: User[], currentUserId: string) => {
    const userIds = users.map(u => u.id);
    const subscriptions = await Subscription.findAll({
        where: {
            followerId: currentUserId,
            followingId: { [Op.in]: userIds }
        }
    });
    const followingIds = new Set(subscriptions.map(s => s.followingId));

    return users.map(user => {
        const userJson = user.toJSON();
        delete userJson.password;
        return {
            ...userJson,
            isFollowing: followingIds.has(user.id)
        };
    });
};

// Main Search Function
export const search = async (req: Request, res: Response) => {
    try {
        const { query, type = 'all', sortBy = 'newest', hashtag } = req.query;
        const currentUserId = req.user.id;

        if (!query && !hashtag) {
            return res.json({ users: [], publications: [] });
        }

        let usersResult = [];
        let publicationsResult = [];

        // --- Search Publications ---
        if (type === 'all' || type === 'publications') {
            let pubWhere: any = {};
            let pubOrder: any = [['createdAt', 'DESC']];

            if (query && typeof query === 'string') {
                pubWhere[Op.or] = [
                    { content: { [Op.iLike]: `%${query}%` } },
                    { '$author.username$': { [Op.iLike]: `%${query}%` } }
                ];
            }

            if (hashtag && typeof hashtag === 'string') {
                pubWhere.content = { [Op.iLike]: `%#${hashtag}%` };
            }

            if (sortBy === 'popular') {
                pubOrder = [['likeCount', 'DESC']];
            } else if (sortBy === 'oldest') {
                pubOrder = [['createdAt', 'ASC']];
            }

            publicationsResult = await Publication.findAll({
                where: pubWhere,
                include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullname', 'avatar'] }],
                order: pubOrder,
                limit: 20
            });
        }

        // --- Search Users ---
        if (type === 'all' || type === 'users') {
            if (query && typeof query === 'string') {
                const users = await User.findAll({
                    where: {
                        [Op.or]: [
                            { username: { [Op.iLike]: `%${query}%` } },
                            { fullname: { [Op.iLike]: `%${query}%` } }
                        ],
                        id: { [Op.ne]: currentUserId }
                    },
                    attributes: ['id', 'username', 'fullname', 'bio', 'avatar'],
                    limit: 10
                });
                usersResult = await addIsFollowingInfoToUsers(users, currentUserId);
            }
        }

        res.json({ users: usersResult, publications: publicationsResult });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Server error during search.' });
    }
};