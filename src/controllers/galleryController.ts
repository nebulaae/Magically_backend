import { Gallery } from '../models/Gallery';
import { Request, Response } from 'express';

// --- Get User's Private Gallery ---
export const getMyGallery = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;

        const galleryItems = await Gallery.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']],
        });

        if (!galleryItems) {
            return res.status(200).json([]);
        }

        res.status(200).json(galleryItems);
    } catch (error) {
        console.error('Get gallery error:', error);
        res.status(500).json({ message: 'Server error while fetching gallery.' });
    }
};