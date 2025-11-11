import fs from "fs"; // [FIX] Импорт fs для удаления файлов
import db from "../../../shared/config/database";
import { logger } from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as nanoService from "../service/nanoService";
import * as apiResponse from "../../../shared/utils/apiResponse";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateImage = async (req: Request, res: Response) => {
    const { prompt, aspect_ratio } = req.body;
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
            aspect_ratio?: string;
            image_urls?: string[];
        } = { prompt };

        if (aspect_ratio) payload.aspect_ratio = aspect_ratio;

        if (files && files.length > 0) {
            payload.image_urls = files.map(
                (file) => `${process.env.BACKEND_URL}/ai/nano/${file.filename}`,
            );
        } else if (
            req.body.image_urls &&
            Array.isArray(req.body.image_urls) &&
            req.body.image_urls.length > 0
        ) {
            payload.image_urls = req.body.image_urls;
        }

        const nanoResponse = await nanoService.generateNanoImage(payload);

        const taskId = nanoResponse?.data?.task_id;
        if (!taskId) {
            throw new Error("Failed to get a task ID from Nano API.");
        }

        let finalImageUrl: string | null = null;
        for (let attempts = 0; attempts < 60; attempts++) {
            await sleep(1000);
            try {
                const statusResponse = await nanoService.getNanoImageStatus(taskId);
                const status = statusResponse?.data?.status;

                if (status === "completed") {
                    finalImageUrl = statusResponse?.data?.output?.image_url || null;
                    break;
                } else if (status === "failed") {
                    const errMsg =
                        statusResponse?.data?.error?.message ||
                        "Nano image generation failed.";
                    throw new Error(errMsg);
                }
                // Если status 'processing' или 'pending', просто продолжаем цикл
            } catch (pollError: any) {
                logger.warn(
                    `Polling attempt ${attempts + 1
                    } for Nano task ${taskId} failed: ${pollError.message}`,
                );
            }
        }

        if (!finalImageUrl) {
            throw new Error(
                "API did not return an image URL or generation timed out.",
            );
        }

        await t.commit();

        apiResponse.success(
            res,
            {
                imageUrl: finalImageUrl,
                prompt: prompt,
            },
            "Image generated successfully. Please confirm your action.",
        );
    } catch (error) {
        await t.rollback();
        logger.error(`Nano image generation process error: ${error.message}`);
        apiResponse.internalError(
            res,
            error.message || "An error occurred during the image generation process.",
        );
    } finally {
        // [FIX] Очищаем загруженные файлы в любом случае
        files?.forEach((file) => {
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
    }
};