import express from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler';
import { Trend } from '../admin/models/Trend';
import * as apiResponse from '../../shared/utils/apiResponse';

const router = express.Router();

router.get(
    '/',
    asyncHandler(async (req, res) => {
        const { page = '1', limit = '20' } = req.query;
        const offset = (Number(page) - 1) * Number(limit);

        const trends = await Trend.findAndCountAll({
            order: [['createdAt', 'DESC']],
            limit: Number(limit),
            offset,
        });

        apiResponse.success(res, {
            trends: trends.rows,
            total: trends.count,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(trends.count / Number(limit)),
        });
    })
);

router.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        const trend = await Trend.findByPk(id);
        if (!trend) return apiResponse.notFound(res, 'Trend not found');
        apiResponse.success(res, trend);
    })
);

export default router;