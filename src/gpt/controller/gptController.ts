import fs from "fs";
import db from "../../../shared/config/database";
import { logger } from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as gptService from "../service/gptService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import * as historyService from "../../history/service/historyService";

export const generateImage = async (req: Request, res: Response) => {
  const { prompt } = req.body;
  const userId = req.user.id;
  const files = req.files as Express.Multer.File[];

  if (!prompt) {
    return apiResponse.badRequest(res, "Prompt is required.");
  }

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(userId, "image", t);

    const imageUrls: string[] = [];
    if (files && files.length > 0) {
      files.forEach((file) => {
        imageUrls.push(`${process.env.BACKEND_URL}/ai/gpt/${file.filename}`);
      });
    }

    const gptResponse = await gptService.generateGptImage(prompt, imageUrls);
    const taskId = gptResponse?.data?.task_id;

    if (!taskId) {
      throw new Error("Failed to retrieve task_id from GPT response.");
    }

    // Create history record
    const history = await historyService.createGenerationHistory({
      userId,
      service: "gpt",
      serviceTaskId: taskId,
      tokensSpent: 15,
      prompt,
      metadata: { imageUrls },
    });

    await t.commit();

    // Start background polling (non-blocking)
    pollGptStatus(taskId, history.id).catch((err) =>
      logger.error(`Background polling error: ${err.message}`),
    );

    apiResponse.success(
      res,
      { historyId: history.id, taskId },
      "Image generation started.",
      202,
    );
  } catch (error: any) {
    await t.rollback();
    logger.error(`GPT image generation error: ${error.message}`);
    apiResponse.internalError(res, error.message);
  } finally {
    files?.forEach((file) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
  }
};

// Background polling
const pollGptStatus = async (taskId: string, historyId: string) => {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempts = 0; attempts < 60; attempts++) {
    await sleep(5000);
    try {
      const statusResponse = await gptService.getGptImageStatus(taskId);
      const status = statusResponse?.data?.status;

      if (status === "completed") {
        const imageUrl = statusResponse?.data?.output?.image_url;
        await historyService.updateHistoryStatus(historyId, "completed", {
          resultUrl: imageUrl,
        });
        logger.info(`GPT generation ${taskId} completed.`);
        return;
      } else if (status === "failed") {
        const errMsg =
          statusResponse?.data?.error?.message || "Generation failed.";
        await historyService.updateHistoryStatus(historyId, "failed", {
          errorMessage: errMsg,
        });
        logger.error(`GPT generation ${taskId} failed: ${errMsg}`);
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
      return apiResponse.badRequest(
        res,
        "Generation is not completed yet.",
      );
    }

    if (!history.resultUrl) {
      return apiResponse.badRequest(res, "No result available.");
    }

    const result = await gptService.processFinalImage(
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
    logger.error(`Error processing GPT image: ${error.message}`);
    apiResponse.internalError(res, "Failed to process image.");
  }
};