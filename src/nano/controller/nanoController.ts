import fs from "fs";
import db from "../../../shared/config/database";
import { logger } from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as nanoService from "../service/nanoService";
import * as apiResponse from "../../../shared/utils/apiResponse";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateImage = async (req: Request, res: Response) => {
    req.setTimeout(900000); // 15 min timeout

    const { prompt, aspect_ratio, publish } = req.body;
    const file = req.file; // Используем single upload (как в gpt) или array если нужно
    const userId = req.user.id;
    const isPublish = publish === 'true' || publish === true;

    if (!prompt) return apiResponse.badRequest(res, "Prompt is required.");

    const t = await db.transaction();

    try {
        await deductTokensForGeneration(userId, "image", t);

        const payload: any = { prompt, aspect_ratio: aspect_ratio || "1:1" };

        // Если есть файл, формируем URL нашего сервера
        if (file) {
            const serverImageUrl = `${process.env.BACKEND_URL}/ai/nano/${file.filename}`;
            payload.image_urls = [serverImageUrl];
        } else if (req.body.image_urls) {
            // Fallback если юзер шлет ссылки (редко)
            payload.image_urls = req.body.image_urls;
        }

        const nanoResponse = await nanoService.generateNanoImage(payload);
        const taskId = nanoResponse?.data?.task_id;

        if (!taskId) throw new Error("Failed to get task ID from Nano");

        let finalImageUrl: string | null = null;

        // Поллинг
        for (let attempts = 0; attempts < 120; attempts++) {
            await sleep(2000);
            const statusResponse = await nanoService.getNanoImageStatus(taskId);
            const status = statusResponse?.data?.status;

            if (status === "completed") {
                finalImageUrl = statusResponse?.data?.output?.image_url;
                break;
            } else if (status === "failed") {
                throw new Error(statusResponse?.data?.error?.message || "Nano generation failed");
            }
        }

        if (!finalImageUrl) throw new Error("Generation timed out");

        // Скачивание и сохранение
        const resultItem = await nanoService.processFinalImage(
            isPublish,
            userId,
            finalImageUrl,
            prompt,
            t
        );

        await t.commit();
        apiResponse.success(res, resultItem, "Generated successfully");

    } catch (error) {
        await t.rollback();
        logger.error(`Nano Error: ${error.message}`);
        apiResponse.internalError(res, error.message);
    } finally {
        // Удаляем загруженный файл референса, если он больше не нужен (или оставляем, если это референс)
        // Обычно референсы лучше оставить, пока генерация идет, но после - можно удалить, если не используем в галерее.
        // Здесь оставим логику удаления, если это временный файл
        // if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
};