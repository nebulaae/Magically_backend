import { Op } from 'sequelize';
import { Gallery } from '../models/Gallery';
import { Request, Response } from 'express';

export const getMyGallery = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { sortBy = 'newest', searchQuery, date } = req.query;

        let order: any = [['createdAt', 'DESC']];
        if (sortBy === 'oldest') {
            order = [['createdAt', 'ASC']];
        }

        let whereClause: any = { userId };

        if (searchQuery && typeof searchQuery === 'string') {
            whereClause.prompt = { [Op.iLike]: `%${searchQuery}%` };
        }

        if (date && typeof date === 'string') {
            const startDate = new Date(date);
            startDate.setUTCHours(0, 0, 0, 0);
            const endDate = new Date(startDate);
            endDate.setUTCDate(startDate.getUTCDate() + 1);

            whereClause.createdAt = {
                [Op.gte]: startDate,
                [Op.lt]: endDate,
            };
        }

        const galleryItems = await Gallery.findAll({
            where: whereClause,
            order: order,
        });

        res.status(200).json(galleryItems);
    } catch (error) {
        console.error('Get gallery error:', error);
        res.status(500).json({ message: 'Server error while fetching gallery.' });
    }
};