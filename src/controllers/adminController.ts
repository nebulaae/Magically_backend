import db from '../config/database';
import { User } from '../models/User';
import { Request, Response } from 'express';
import { Publication } from '../models/Publication';
import { generateToken } from '../services/authService';

// Admin Login
export const login = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const adminUser = await User.findOne({ where: { username, role: 'admin' } });

    if (!adminUser || !(await adminUser.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid admin credentials' });
    }

    const token = generateToken(adminUser.id);
    res.json({ token, user: adminUser });
};

// Get All Users
export const getAllUsers = async (req: Request, res: Response) => {
    const users = await User.findAll({ attributes: { exclude: ['password'] } });
    res.json(users);
};

// Block a User
export const blockUser = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isBlocked = true;
    await user.save();
    res.json({ message: `User ${user.username} has been blocked.` });
};

// Unblock a User
export const unblockUser = async (req: Request, res: Response) => {
    const { userId } = req.params;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isBlocked = false;
    await user.save();
    res.json({ message: `User ${user.username} has been unblocked.` });
};

// Delete any publication
export const deletePublication = async (req: Request, res: Response) => {
    const { publicationId } = req.params;
    const publication = await Publication.findByPk(publicationId);
    if (!publication) return res.status(404).json({ message: 'Publication not found' });

    await publication.destroy();
    res.json({ message: 'Publication deleted successfully.' });
};

// Set Photo of the Day
export const setPhotoOfTheDay = async (req: Request, res: Response) => {
    const { publicationId } = req.params;
    const t = await db.transaction();
    try {
        // First, unset any existing photo of the day
        await Publication.update(
            { isPhotoOfTheDay: false },
            { where: { isPhotoOfTheDay: true }, transaction: t }
        );

        // Then, set the new one
        const [updatedCount] = await Publication.update(
            { isPhotoOfTheDay: true },
            { where: { id: publicationId }, transaction: t }
        );

        if (updatedCount === 0) {
            throw new Error('Publication not found.');
        }

        await t.commit();
        res.json({ message: 'Photo of the Day has been set.' });
    } catch (error) {
        await t.rollback();
        console.error("Set Photo of the Day error:", error);
        res.status(500).json({ message: error.message || 'Server error.' });
    }
};