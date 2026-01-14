import db from "../../../shared/config/database";
import { Request, Response } from "express";
import * as ttapiService from "../service/ttapiService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import { GenerationJob } from "../../publication/models/GenerationJob";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";

// --- Models CRUD ---

export const createModel = async (req: Request, res: Response) => {
    const { name, description } = req.body;
    const files = req.files as Express.Multer.File[];
    const userId = req.user.id;

    if (!files || files.length !== 4) {
        return apiResponse.badRequest(res, "Exactly 4 images are required.");
    }
    if (!name) {
        return apiResponse.badRequest(res, "Model name is required.");
    }

    const model = await ttapiService.createTtModel(userId, name, description, files);
    apiResponse.success(res, model, "Model created successfully.", 201);
};

export const getModels = async (req: Request, res: Response) => {
    const userId = req.user.id;
    const models = await ttapiService.getUserModels(userId);
    apiResponse.success(res, models);
};

export const deleteModel = async (req: Request, res: Response) => {
    const userId = req.user.id;
    const modelId = Array.isArray(req.params.modelId) ? req.params.modelId[0] : req.params.modelId;
    await ttapiService.deleteTtModel(userId, modelId);
    apiResponse.success(res, null, "Model deleted.");
};

export const getModel = async (req: Request, res: Response) => {
    const modelId = Array.isArray(req.params.modelId) ? req.params.modelId[0] : req.params.modelId;
    const userId = req.user.id;

    const model = await ttapiService.getTtModelById(userId, modelId);

    if (!model) {
        return apiResponse.notFound(res, "Model not found");
    }

    apiResponse.success(res, model);
};

// --- Generation ---

// ... imports

// Update generate function
export const generate = async (req: Request, res: Response) => {
    const { prompt, modelId, publish, width, height, seed, safety_tolerance } = req.body;
    const userId = req.user.id;
    const isPublish = publish === 'true' || publish === true;

    if (!prompt || !modelId) {
        return apiResponse.badRequest(res, "Prompt and Model ID are required.");
    }

    const t = await db.transaction();

    try {
        await deductTokensForGeneration(userId, "image", t);

        // Передаем новые параметры
        const result = await ttapiService.generateImage(userId, prompt, modelId, {
            width,
            height,
            seed,
            safety_tolerance
        });

        const taskId = result?.data?.jobId; // Исходя из структуры ответа 200 response

        if (!taskId) {
            throw new Error("Failed to retrieve Job ID from TTAPI");
        }

        const job = await GenerationJob.create({
            userId,
            service: "ttapi" as any,
            serviceTaskId: taskId,
            status: "pending",
            meta: {
                prompt,
                publish: isPublish,
                modelId,
                seed,
                width,
                height
            }
        }, { transaction: t });

        await t.commit();
        apiResponse.success(res, { jobId: job.id }, "Flux 2 Pro generation started.");
    } catch (error: any) {
        await t.rollback();
        apiResponse.internalError(res, error.message);
    }
};