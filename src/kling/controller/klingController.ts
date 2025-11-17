import fs from "fs";
import db from "../../../shared/config/database";
import logger from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as klingService from "../service/klingService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import * as historyService from "../../history/service/historyService";

export const generateVideo = async (req: Request, res: Response) => {
  const { prompt, duration = 5, mode = "std" } = req.body;
  const file = req.file;
  const userId = req.user.id;

  if (!prompt) {
    return apiResponse.badRequest(res, "Prompt is required.");
  }

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(userId, "video", t);

    const payload: {
      prompt: string;
      duration: number;
      mode: "std" | "pro";
      image_url?: string;
    } = {
      prompt,
      duration: parseInt(duration, 10),
      mode,
    };

    if (file) {
      payload.image_url = `${process.env.BACKEND_URL}/ai/kling/${file.filename}`;
    }

    const genResponse = await klingService.generateKlingVideo(payload);
    const taskId = genResponse?.data?.task_id;

    if (!taskId) {
      throw new Error("Failed to get a task ID from Kling.");
    }

    const history = await historyService.createGenerationHistory({
      userId,
      service: "kling",
      serviceTaskId: taskId,
      tokensSpent: 40,
      prompt,
      metadata: { duration, mode, image_url: payload.image_url },
    });

    await t.commit();

    // Background polling
    pollKlingStatus(taskId, history.id).catch((err) =>
      logger.error(`Background polling error: ${err.message}`),
    );

    apiResponse.success(
      res,
      { historyId: history.id, taskId },
      "Video generation started.",
      202,
    );
  } catch (error) {
    await t.rollback();
    logger.error(`Kling video generation error: ${error.message}`);
    apiResponse.internalError(res, error.message);
  } finally {
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
};

const pollKlingStatus = async (taskId: string, historyId: string) => {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempts = 0; attempts < 60; attempts++) {
    await sleep(5000);
    try {
      const statusResponse = await klingService.getKlingVideoStatus(taskId);
      const status = statusResponse?.data?.status;

      if (status === "completed") {
        const videoUrl = statusResponse?.data?.video_url;
        await historyService.updateHistoryStatus(historyId, "completed", {
          resultUrl: videoUrl,
        });
        logger.info(`Kling generation ${taskId} completed.`);
        return;
      } else if (status === "failed") {
        const errMsg =
          statusResponse?.data?.error?.message || "Generation failed.";
        await historyService.updateHistoryStatus(historyId, "failed", {
          errorMessage: errMsg,
        });
        logger.error(`Kling generation ${taskId} failed: ${errMsg}`);
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

export const processVideo = async (req: Request, res: Response) => {
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

    const result = await klingService.processFinalVideo(
      publish,
      userId,
      history.resultUrl,
      history.prompt || "",
    );

    const message = publish
      ? "Video published successfully."
      : "Video saved to your gallery.";
    apiResponse.success(res, result, message, 201);
  } catch (error) {
    logger.error(`Error processing Kling video: ${error.message}`);
    apiResponse.internalError(res, "Failed to process video.");
  }
};