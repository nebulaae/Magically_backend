import { Request, Response } from "express";
import * as recommendationService from "../service/recommendationService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import logger from "../../../shared/utils/logger";

export const getRecommendedUsers = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { limit = "10" } = req.query as { limit?: string };

        const users = await recommendationService.getRecommendedUsers(
            userId,
            parseInt(limit, 10)
        );

        apiResponse.success(res, users);
    } catch (error) {
        logger.error(`Get recommended users error: ${error.message}`);
        apiResponse.internalError(res, "Server error");
    }
};