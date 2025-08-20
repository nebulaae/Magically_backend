import fs from 'fs';
import path from 'path';
import db from '../config/database';

import { Op } from 'sequelize';
import { User } from '../models/User';
import { Request, Response } from 'express';
import { handleUserAction } from '../lib/utils';
import { Publication } from '../models/Publication';
import { Subscription } from '../models/Subscription';
import { LikedPublication } from '../models/LikedPublication';

// Helper function from publicationController - assuming it's exported or moved to a shared service
const addExtraInfoToPublications = async (publications: Publication[], userId: string) => {
    const authorIds = publications.map(p => p.userId);
    const publicationIds = publications.map(p => p.id);

    const following = await Subscription.findAll({
        where: { followerId: userId, followingId: { [Op.in]: authorIds } },
    });
    const followingIds = new Set(following.map(sub => sub.followingId));

    const liked = await LikedPublication.findAll({
        where: { userId: userId, publicationId: { [Op.in]: publicationIds } },
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

// Helper function to add isFollowing flag to a list of users
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
        delete userJson.password; // ensure password is not returned
        return {
            ...userJson,
            isFollowing: followingIds.has(user.id)
        };
    });
};

// --- Get User Profile ---
export const getProfile = async (req: Request, res: Response) => {
    try {
        const { username } = req.params;
        const currentUser = req.user;

        const user = await User.findOne({
            where: { username },
            attributes: { exclude: ['password', 'email'] },
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const publications = await user.getPublications({
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullname', 'avatar'] }],
            order: [['createdAt', 'DESC']]
        });
        const publicationsWithInfo = await addExtraInfoToPublications(publications, currentUser.id);

        const publicationsCount = publications.length;
        const followersCount = (await user.getFollowers()).length;
        const followingCount = (await user.getFollowing()).length;

        let isFollowing = false;
        if (currentUser && currentUser.id !== user.id) {
            const subscription = await Subscription.findOne({
                where: {
                    followerId: currentUser.id,
                    followingId: user.id
                }
            });
            isFollowing = !!subscription;
        } else if (currentUser && currentUser.id === user.id) {
            isFollowing = false; // You don't follow yourself
        }

        const userResponse = user.get({ plain: true });

        res.json({
            ...userResponse,
            publicationsCount,
            followersCount,
            followingCount,
            isFollowing,
            publications: publicationsWithInfo // [NEW] Return publications
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Get Current Authenticated User Profile ---
export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }, // email can be included for self-profile
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const publications = await user.getPublications({
            include: [{ model: User, as: 'author', attributes: ['id', 'username', 'fullname', 'avatar'] }],
            order: [['createdAt', 'DESC']]
        });
        const publicationsWithInfo = await addExtraInfoToPublications(publications, userId);

        const publicationsCount = publications.length;
        const followersCount = (await user.getFollowers()).length;
        const followingCount = (await user.getFollowing()).length;

        const userResponse = user.get({ plain: true });

        res.json({
            ...userResponse,
            publicationsCount,
            followersCount,
            followingCount,
            publications: publicationsWithInfo // [NEW] Return publications
        });
    } catch (error) {
        console.error('Get current user profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Get My Followers ---
export const getMyFollowers = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const followers = await user.getFollowers({
            attributes: ['id', 'username', 'fullname', 'avatar']
        });

        const followersWithInfo = await addIsFollowingInfoToUsers(followers, userId);

        res.json(followersWithInfo);
    } catch (error) {
        console.error('Get my followers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Get My Followings ---
export const getMyFollowings = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const followings = await user.getFollowing({
            attributes: ['id', 'username', 'fullname', 'avatar']
        });

        const followingsWithInfo = await addIsFollowingInfoToUsers(followings, userId);

        res.json(followingsWithInfo);
    } catch (error) {
        console.error('Get my followings error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Update Current User's Profile ---
export const updateProfile = async (req: Request, res: Response) => {
    try {
        const { fullname, bio, interests } = req.body;
        const userId = req.user.id;

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.fullname = fullname || user.fullname;
        user.bio = bio || user.bio;

        if (Array.isArray(interests)) {
            user.interests = interests;
        }

        await user.save();

        const { password, ...userResponse } = user.get({ plain: true });
        res.json({ message: 'Profile updated successfully', user: userResponse });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Update User Avatar ---
export const updateAvatar = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.avatar) {
            const oldAvatarPath = path.join(__dirname, '../../public', user.avatar);
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded.' });
        }

        const avatarUrlPath = `/users/avatars/${req.file.filename}`;
        user.avatar = avatarUrlPath;
        await user.save();

        const { password, ...userResponse } = user.get({ plain: true });
        res.json({ message: 'Avatar updated successfully', user: userResponse });

    } catch (error) {
        console.error('Update avatar error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Search for Users ---
export const searchUsers = async (req: Request, res: Response) => {
    try {
        const { query } = req.query;
        const currentUserId = req.user.id;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({ message: 'Search query is required' });
        }

        const users = await User.findAll({
            where: {
                [Op.or]: [
                    { username: { [Op.iLike]: `%${query}%` } },
                    { fullname: { [Op.iLike]: `%${query}%` } }
                ],
                id: { [Op.ne]: currentUserId } // Exclude self from search results
            },
            attributes: ['id', 'username', 'fullname', 'bio', 'avatar'],
            limit: 10
        });

        const usersWithFollowingInfo = await addIsFollowingInfoToUsers(users, currentUserId);

        res.json(usersWithFollowingInfo);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Subscribe (Follow) a User ---
export const subscribe = async (req: Request, res: Response) => {
    try {
        const followerId = req.user.id;
        const { userId: followingId } = req.params;

        if (followerId === followingId) {
            return res.status(400).json({ message: "You cannot follow yourself." });
        }

        const userToFollow = await User.findByPk(followingId);
        if (!userToFollow) {
            return res.status(404).json({ message: 'User to follow not found' });
        }

        const me = await User.findByPk(followerId);
        await me.addFollowing(userToFollow);

        await db.transaction(async (t) => {
            await handleUserAction(me, 10, t);
        })

        res.status(200).json({ message: `Successfully followed ${userToFollow.username}` });
    } catch (error) {
        console.error('Subscribe error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'You are already following this user.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Unsubscribe (Unfollow) a User ---
export const unsubscribe = async (req: Request, res: Response) => {
    try {
        const followerId = req.user.id;
        const { userId: followingId } = req.params;

        const userToUnfollow = await User.findByPk(followingId);
        if (!userToUnfollow) {
            return res.status(404).json({ message: 'User to unfollow not found' });
        }

        const me = await User.findByPk(followerId);
        const result = await me.removeFollowing(userToUnfollow);

        if (result === null) {
            return res.status(404).json({ message: "You are not following this user." });
        }

        res.status(200).json({ message: `Successfully unfollowed ${userToUnfollow.username}` });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// --- Get User's Followers ---
export const getFollowers = async (req: Request, res: Response) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.id;

        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const followers = await user.getFollowers({
            attributes: ['id', 'username', 'fullname', 'avatar']
        });

        const followersWithInfo = await addIsFollowingInfoToUsers(followers, currentUserId);

        res.json(followersWithInfo);
    } catch (error) {
        console.error('Get followers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

// --- Get User's Following ---
export const getFollowing = async (req: Request, res: Response) => {
    try {
        const { username } = req.params;
        const currentUserId = req.user.id;

        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const following = await user.getFollowing({
            attributes: ['id', 'username', 'fullname', 'avatar']
        });

        const followingWithInfo = await addIsFollowingInfoToUsers(following, currentUserId);

        res.json(followingWithInfo);
    } catch (error) {
        console.error('Get following error:', error);
        res.status(500).json({ message: 'Server error' });
    }
}
