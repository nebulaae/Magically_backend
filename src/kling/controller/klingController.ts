import fs from "fs";
import db from "../../../shared/config/database";
import logger from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as klingService from "../service/klingService";
import * as apiResponse from "../../../shared/utils/apiResponse";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateVideo = async (req: Request, res: Response) => {
  req.setTimeout(1200000);

  const { model, prompt, duration, aspect_ratio, negative_prompt, effect, publish } = req.body;
  const file = req.file;
  const userId = req.user.id;
  const isPublish = publish === 'true' || publish === true;

  if (!file) return apiResponse.badRequest(res, "Image is required for Kling.");

  const t = await db.transaction();

  try {
    await deductTokensForGeneration(userId, "video", t);

    // 1. Формируем URL загруженного файла
    const imageUrl = `${process.env.BACKEND_URL}/ai/kling/${file.filename}`;

    const payload = {
      model: model || "2.1-master",
      image_url: imageUrl,
      prompt,
      duration: parseInt(duration, 10) || 5,
      aspect_ratio: aspect_ratio || "16:9",
      negative_prompt,
      effect,
    };

    const genResponse = await klingService.generateKlingVideo(payload);

    let taskId = genResponse?.data?.task_id || genResponse?.data_id;

    if (!taskId) throw new Error("Failed to get Kling Task ID");

    let videoUrl: string | null = null;

    for (let attempts = 0; attempts < 150; attempts++) {
      await sleep(10000);
      const statusResponse = await klingService.getKlingVideoStatus(taskId);
      const status = statusResponse?.data?.status;

      if (status === "completed") {
        videoUrl = statusResponse?.data?.video_url || statusResponse?.data?.output?.video_url;
        break;
      } else if (status === "failed") {
        throw new Error(statusResponse?.data?.error?.message || "Kling failed");
      }
    }

    if (!videoUrl) throw new Error("Timeout waiting for Kling");

    const resultItem = await klingService.processFinalVideo(
      isPublish,
      userId,
      videoUrl,
      prompt,
      t
    );

    await t.commit();
    apiResponse.success(res, resultItem, "Video generated successfully");

  } catch (error) {
    await t.rollback();
    logger.error(`Kling Error: ${error.message}`);
    apiResponse.internalError(res, error.message);
  } finally {
    // Можно удалить исходную картинку, если она не нужна
  }
};