import { Request, Response } from "express";
import * as historyService from "../service/historyService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import logger from "../../../shared/utils/logger";

export const getMyHistory = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { page = "1", limit = "20" } = req.query;

        const result = await historyService.getUserHistory(
            userId,
            parseInt(page as string, 10),
            parseInt(limit as string, 10),
        );

        apiResponse.success(res, result);
    } catch (error) {
        logger.error(`Get history error: ${error.message}`);
        apiResponse.internalError(res, "Failed to retrieve history");
    }
};

export const getHistoryById = async (req: Request, res: Response) => {
    try {
        const { historyId } = req.params;
        const history = await historyService.getHistoryById(historyId);

        apiResponse.success(res, history);
    } catch (error) {
        logger.error(`Get history by ID error: ${error.message}`);
        if (error.message.includes("not found")) {
            return apiResponse.notFound(res, error.message);
        }
        apiResponse.internalError(res, "Failed to retrieve history");
    }
};