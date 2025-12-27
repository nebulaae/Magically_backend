import db from "../../../shared/config/database";
import { Request, Response } from "express";
import { GenerationJob } from "../../publication/models/GenerationJob";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as gptService from "../service/gptService";
import * as apiResponse from "../../../shared/utils/apiResponse";

export const generateImage = async (req: Request, res: Response) => {
    const { prompt, aspect_ratio, publish, model_type } = req.body;
    const userId = req.user.id;
    const isPublish = publish === 'true' || publish === true;
    
    const isVersion1_5 = model_type === "gpt-1.5";
    const serviceName = isVersion1_5 ? "gpt-1.5" : "gpt";

    const t = await db.transaction();
    try {
        await deductTokensForGeneration(userId, "image", t);

        const payload = { prompt, aspect_ratio: aspect_ratio || "1:1" };
        
        const apiRes = await gptService.generateGptImage(payload, isVersion1_5);
        const taskId = apiRes?.data?.task_id;

        const job = await GenerationJob.create({
            userId,
            service: serviceName,
            serviceTaskId: taskId,
            status: "pending",
            meta: { prompt, aspect_ratio, publish: isPublish, model_type }
        }, { transaction: t });

        await t.commit();
        
        apiResponse.success(res, { jobId: job.id }, "GPT generation started.");
    } catch (error) {
        await t.rollback();
        apiResponse.internalError(res, error.message);
    }
};