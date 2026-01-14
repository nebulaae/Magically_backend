import db from "../../../shared/config/database";
import { Request, Response } from "express";
import { GenerationJob } from "../../publication/models/GenerationJob";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as fluxService from "../service/fluxService";
import * as apiResponse from "../../../shared/utils/apiResponse";

export const generateImage = async (req: Request, res: Response) => {
    const { prompt, aspect_ratio, publish, image_urls } = req.body;
    const userId = req.user.id;
    const isPublish = publish === 'true' || publish === true;

    if (!prompt) return apiResponse.badRequest(res, "Prompt is required.");

    const t = await db.transaction();
    try {
        await deductTokensForGeneration(userId, "image", t);

        const payload: any = {
            prompt,
            aspect_ratio: aspect_ratio || "1:1",
            quality: "2K"
        };

        if (image_urls && Array.isArray(image_urls)) {
            payload.image_urls = image_urls;
        }

        const fluxResponse = await fluxService.generateFluxImage(payload);
        const taskId = fluxResponse?.data?.task_id;

        if (!taskId) throw new Error("No task ID received from Flux service");

        const job = await GenerationJob.create({
            userId,
            service: "flux" as any,
            serviceTaskId: taskId,
            status: "pending",
            meta: {
                prompt,
                aspect_ratio,
                publish: isPublish,
                provider: "unifically"
            }
        }, { transaction: t });

        await t.commit();
        apiResponse.success(res, { jobId: job.id, status: "pending" }, "Flux generation started.");
    } catch (error: any) {
        await t.rollback();
        apiResponse.internalError(res, error.message);
    }
};