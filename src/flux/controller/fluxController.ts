import db from "../../../shared/config/database";
import { Request, Response } from "express";
import { GenerationJob } from "../../publication/models/GenerationJob";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as fluxService from "../service/fluxService";
import * as apiResponse from "../../../shared/utils/apiResponse";

// --- Models CRUD ---

export const createModel = async (req: Request, res: Response) => {
    const { name, description, instruction } = req.body;
    const files = req.files as Express.Multer.File[];
    const userId = req.user.id;

    if (!files || files.length === 0) {
        return apiResponse.badRequest(res, "At least 1 image is required.");
    }
    if (!name) {
        return apiResponse.badRequest(res, "Model name is required.");
    }

    const model = await fluxService.createFluxModel(userId, name, description, instruction, files);
    apiResponse.success(res, model, "Flux Model created successfully.", 201);
};

export const updateModel = async (req: Request, res: Response) => {
    const { modelId } = req.params;
    const { name, description, instruction } = req.body;
    const files = req.files as Express.Multer.File[];

    const model = await fluxService.updateFluxModel(req.user.id, modelId as string, { name, description, instruction }, files);
    apiResponse.success(res, model, "Flux Model updated successfully.");
};

export const deleteModel = async (req: Request, res: Response) => {
    const { modelId } = req.params;
    await fluxService.deleteFluxModel(req.user.id, modelId as string);
    apiResponse.success(res, null, "Flux Model deleted.");
};

export const getModels = async (req: Request, res: Response) => {
    const models = await fluxService.getUserFluxModels(req.user.id);
    apiResponse.success(res, models);
};

export const getModel = async (req: Request, res: Response) => {
    const { modelId } = req.params;
    const model = await fluxService.getFluxModelById(req.user.id, modelId as string);
    if (!model) return apiResponse.notFound(res, "Flux Model not found");
    apiResponse.success(res, model);
};

// --- Generation ---

export const generateImage = async (req: Request, res: Response) => {
    const { prompt, aspect_ratio, publish, modelId } = req.body;
    const userId = req.user.id;
    const isPublish = publish === "true" || publish === true;

    if (!prompt || !modelId) return apiResponse.badRequest(res, "Prompt and Model ID are required.");

    const t = await db.transaction();
    try {
        await deductTokensForGeneration(userId, "image", t);

        const fluxResponse = await fluxService.generateFluxImage(userId, modelId, prompt, aspect_ratio);
        const taskId = fluxResponse?.data?.task_id;

        if (!taskId) throw new Error("No task ID received from Flux service");

        const job = await GenerationJob.create(
            {
                userId,
                service: "flux" as any,
                serviceTaskId: taskId,
                status: "pending",
                meta: {
                    prompt,
                    aspect_ratio,
                    publish: isPublish,
                    provider: "unifically",
                    modelId,
                },
            },
            { transaction: t }
        );
        await t.commit();
        apiResponse.success(res, { jobId: job.id, status: "pending" }, "Flux generation started.");
    } catch (error: any) {
        await t.rollback();
        apiResponse.internalError(res, error.message);
    }
};