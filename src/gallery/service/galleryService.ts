import db from '../../../shared/config/database';
import { Op } from 'sequelize';
import { Gallery } from '../models/Gallery';
import { Publication } from '../../publication/models/Publication';
import * as galleryRepository from '../repository/galleryRepository';

export const getUserGallery = (
  userId: string,
  sortBy: string,
  searchQuery: string,
  date: string
) => {
  let order: any = [['createdAt', 'DESC']];
  if (sortBy === 'oldest') {
    order = [['createdAt', 'ASC']];
  }

  const whereClause: any = {};
  if (searchQuery) {
    whereClause.prompt = { [Op.iLike]: `%${searchQuery}%` };
  }
  if (date) {
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 1);
    whereClause.createdAt = { [Op.gte]: startDate, [Op.lt]: endDate };
  }

  return galleryRepository.findGalleryItemsByUserId(userId, whereClause, order);
};

// ✅ NEW: Публикация из галереи
export const publishFromGallery = async (
  galleryItemId: string,
  userId: string
) => {
  const t = await db.transaction();
  try {
    const galleryItem = await Gallery.findByPk(galleryItemId, {
      transaction: t,
      lock: true,
    });

    if (!galleryItem) {
      throw new Error('Gallery item not found');
    }

    if (galleryItem.userId !== userId) {
      throw new Error('Access denied');
    }

    // Создаём публикацию
    const publication = await Publication.create(
      {
        userId,
        content: galleryItem.prompt || 'Generated image',
        imageUrl: galleryItem.imageUrl,
        category: 'ai',
      },
      { transaction: t }
    );

    await t.commit();
    return publication;
  } catch (error) {
    await t.rollback();
    throw error;
  }
};
