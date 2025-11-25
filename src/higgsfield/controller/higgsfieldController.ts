import fs from "fs";
import db from "../../../shared/config/database";
import logger from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as higgsfieldService from "../service/higgsfieldService";
import * as historyService from "../../history/service/historyService";
import * as apiResponse from "../../../shared/utils/apiResponse";

export const generateHiggsfieldVideo = async (req: Request, res: Response) => {
  const { prompt, motion_id, model, enhance_prompt, seed } = req.body;
  const files = req.files as Express.Multer.File[];
  const userId = req.user.id;

  if (!prompt || !motion_id) {
    return apiResponse.badRequest(
      res,
      "Both 'prompt' and 'motion_id' are required."
    );
  }

  if (!files || files.length < 1) {
    return apiResponse.badRequest(
      res,
      "At least one image (start frame) is required."
    );
  }

  const startImageUrl = `${process.env.BACKEND_URL}/ai/higgsfield/${files[0].filename}`;
  const endImageUrl =
    files.length > 1
      ? `${process.env.BACKEND_URL}/ai/higgsfield/${files[1].filename}`
      : undefined;

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(userId, "video", t);

    const payload = {
      prompt,
      motion_id,
      model: model || "standard",
      enhance_prompt: enhance_prompt === "true" || false,
      seed: seed ? parseInt(seed, 10) : undefined,
      start_image_url: startImageUrl,
      end_image_url: endImageUrl,
    };

    const genResponse = await higgsfieldService.generateVideo(payload);
    const taskId =
      genResponse?.data?.task_id ||
      genResponse?.task_id ||
      genResponse?.data_id;

    if (!taskId) {
      throw new Error("Failed to retrieve task_id from Higgsfield response.");
    }

    // Create history record
    const history = await historyService.createGenerationHistory({
      userId,
      service: "higgsfield",
      serviceTaskId: taskId,
      tokensSpent: 40,
      prompt,
      metadata: {
        motion_id,
        model,
        enhance_prompt,
        seed,
        start_image_url: startImageUrl,
        end_image_url: endImageUrl
      },
    });

    await t.commit();

    // Start background polling
    pollHiggsfieldStatus(taskId, history.id).catch((err) =>
      logger.error(`Background polling error: ${err.message}`)
    );

    apiResponse.success(
      res,
      { historyId: history.id, taskId },
      "Video generation started.",
      202
    );
  } catch (error: any) {
    await t.rollback();
    logger.error(`Higgsfield generation error: ${error.message}`);
    apiResponse.internalError(res, error.message);
  } finally {
    files?.forEach((file) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
  }
};

// Background polling function
const pollHiggsfieldStatus = async (taskId: string, historyId: string) => {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  for (let attempts = 0; attempts < 60; attempts++) {
    await sleep(5000);
    try {
      const statusResponse = await higgsfieldService.getVideoStatus(taskId);
      const job = statusResponse?.jobs?.[0];

      if (!job) continue;

      if (job.status === "completed") {
        const videoUrl = job.result?.url;
        await historyService.updateHistoryStatus(historyId, "completed", {
          resultUrl: videoUrl,
        });
        logger.info(`Higgsfield generation ${taskId} completed.`);
        return;
      } else if (job.status === "failed") {
        const errMsg = "Higgsfield generation failed.";
        await historyService.updateHistoryStatus(historyId, "failed", {
          errorMessage: errMsg,
        });
        logger.error(`Higgsfield generation ${taskId} failed: ${errMsg}`);
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

export const processHiggsfieldVideo = async (req: Request, res: Response) => {
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
        "Generation is not completed yet."
      );
    }

    if (!history.resultUrl) {
      return apiResponse.badRequest(res, "No result available.");
    }

    const result = await higgsfieldService.processFinalVideo(
      publish,
      userId,
      history.resultUrl,
      history.prompt || ""
    );

    const message = publish
      ? "Video published successfully."
      : "Video saved to your gallery.";
    apiResponse.success(res, result, message, 201);
  } catch (error: any) {
    logger.error(`Higgsfield process error: ${error.message}`);
    apiResponse.internalError(res, error.message);
  }
};

export const getHiggsfieldMotions = async (req: Request, res: Response) => {
  try {
    const { size, cursor } = req.query;
    const result = await higgsfieldService.getMotions(
      size ? parseInt(size as string, 10) : 30,
      cursor ? parseInt(cursor as string, 10) : undefined
    );
    apiResponse.success(res, result, "Fetched Higgsfield motion presets.");
  } catch (error: any) {
    logger.error(`Error fetching Higgsfield motions: ${error.message}`);
    apiResponse.internalError(res, error.message);
  }
};