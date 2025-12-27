import { GenerationJob } from "../models/GenerationJob";
import { Request, Response, NextFunction } from "express";
import * as apiResponse from "../../../shared/utils/apiResponse";

export const checkActiveGeneration = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user.id;
    const activeJob = await GenerationJob.findOne({
        where: {
            userId,
            status: "pending"
        }
    });

    if (activeJob) {
        return apiResponse.tooManyRequests(
            res,
            "You already have an active generation running. Please wait for it to finish."
        );
    }
    next();
};