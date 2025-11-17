import fs from "fs";
import db from "../../../shared/config/database";
import { logger } from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as nanoService from "../service/nanoService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import * as historyService from "../../history/service/historyService";

export const generateImage = async (req: Request, res: Response) => {
    const { prompt, aspect_ratio = "1:1" } = req.body;
    const files = req.files as Express.Multer.File[];
    const userId = req.user.id;

    if (!prompt) {
        return apiResponse.badRequest(res, "Prompt is required.");
    }

    const t = await db.transaction();
    try {
        await deductTokensForGeneration(userId, "image", t);

        const payload: {
            prompt: string;
            aspect_ratio: string;
            image_urls?: string[];
        } = { prompt, aspect_ratio };

        if (files && files.length > 0) {
            payload.image_urls = files.map(
                (file) => `${process.env.BACKEND_URL}/ai/nano/${file.filename}`,
            );
        }

        const nanoResponse = await nanoService.generateNanoImage(payload);
        const taskId = nanoResponse?.data?.task_id;

        if (!taskId) {
            throw new Error("Failed to get a task ID from Nano API.");
        }

        const history = await historyService.createGenerationHistory({
            userId,
            service: "nano",
            serviceTaskId: taskId,
            tokensSpent: 15,
            prompt,
            metadata: { aspect_ratio, image_urls: payload.image_urls },
        });

        await t.commit();

        // Background polling
        pollNanoStatus(taskId, history.id).catch((err) =>
            logger.error(`Background polling error: ${err.message}`),
        );

        apiResponse.success(
            res,
            { historyId: history.id, taskId },
            "Image generation started.",
            202,
        );
    } catch (error) {
        await t.rollback();
        logger.error(`Nano image generation error: ${error.message}`);
        apiResponse.internalError(res, error.message);
    } finally {
        files?.forEach((file) => {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
    }
};

const pollNanoStatus = async (taskId: string, historyId: string) => {
    const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempts = 0; attempts < 60; attempts++) {
        await sleep(5000);
        try {
            const statusResponse = await nanoService.getNanoImageStatus(taskId);
            const status = statusResponse?.data?.status;

            if (status === "completed") {
                const imageUrl = statusResponse?.data?.output?.image_url;
                await historyService.updateHistoryStatus(historyId, "completed", {
                    resultUrl: imageUrl,
                });
                logger.info(`Nano generation ${taskId} completed.`);
                return;
            } else if (status === "failed") {
                const errMsg =
                    statusResponse?.data?.error?.message || "Generation failed.";
                await historyService.updateHistoryStatus(historyId, "failed", {
                    errorMessage: errMsg,
                });
                logger.error(`Nano generation ${taskId} failed: ${errMsg}`);
                return;
            }
        } catch (pollError: any) {
            logger.warn(`Polling attempt ${attempts + 1} failed: ${pollError.message}`);
        }
    }

    await historyService.updateHistoryStatus(historyId, "failed", {
        errorMessage: "Generation timed out.",
    });
};

export const processImage = async (req: Request, res: Response) => {
    const { publish, historyId } = req.body;
    const userId = req.user.id;

    if (!historyId) {
        return apiResponse.badRequest(res, "History ID is required.");
    }

    try {
        const history = await historyService.getHistoryById(historyId);

        if (history.userId !== userId) {
            return apiResponse.forbidden(res, "Access denied.");
        }

        if (history.status !== "completed") {
            return apiResponse.badRequest(res, "Generation is not completed yet.");
        }

        if (!history.resultUrl) {
            return apiResponse.badRequest(res, "No result available.");
        }

        const result = await nanoService.processFinalImage(
            publish,
            userId,
            history.resultUrl,
            history.prompt || "",
        );

        const message = publish
            ? "Image published successfully."
            : "Image saved to your gallery.";
        apiResponse.success(res, result, message, 201);
    } catch (error) {
        logger.error(`Error processing Nano image: ${error.message}`);
        apiResponse.internalError(res, "Failed to process image.");
    }
};