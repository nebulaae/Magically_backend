import fs from "fs";
import db from "../../../shared/config/database";
import logger from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as klingService from "../service/klingService";
import * as apiResponse from "../../../shared/utils/apiResponse";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateAndPollKlingVideo = async (
  req: Request,
  res: Response,
) => {
  const { model, prompt, duration, aspect_ratio, negative_prompt, effect } =
    req.body;
  const file = req.file;
  const userId = req.user.id;

  if (!file) {
    return apiResponse.badRequest(
      res,
      "An image is required for Kling generation.",
    );
  }

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(userId, "video", t);
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
    if (!genResponse.success || !genResponse.data.id) {
      throw new Error("Failed to get a task ID from Kling.");
    }

    const taskId = genResponse.data.id;
    let videoUrl: string | null = null;
    for (let attempts = 0; attempts < 60; attempts++) {
      await sleep(5000);
      try {
        const statusResponse = await klingService.getKlingVideoStatus(taskId);
        if (
          statusResponse.success &&
          statusResponse.data.status === "completed"
        ) {
          videoUrl = statusResponse.data.video_url;
          break;
        } else if (
          !statusResponse.success ||
          statusResponse.data.status === "failed"
        ) {
          throw new Error("Kling video generation failed.");
        }
      } catch (pollError) {
        logger.warn(
          `Polling attempt ${attempts + 1} for Kling task ${taskId} failed: ${pollError.message}`,
        );
      }
    }

    if (!videoUrl) throw new Error("Kling video generation timed out.");

    await t.commit();
    apiResponse.success(
      res,
      { videoUrl, prompt },
      "Video generated successfully. Please confirm your action.",
    );
  } catch (error) {
    await t.rollback();
    logger.error(`Kling video generation process error: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "An error occurred during video generation.",
    );
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
};

export const processKlingVideo = async (req: Request, res: Response) => {
  const { publish, videoUrl, prompt } = req.body;
  const userId = req.user.id;

  if (!videoUrl) {
    return apiResponse.badRequest(res, "Video URL is required for processing.");
  }

  try {
    const result = await klingService.processFinalVideo(
      publish,
      userId,
      videoUrl,
      prompt,
    );
    const message = publish
      ? "Video published successfully."
      : "Video saved to your private gallery.";
    apiResponse.success(res, result, message, 201);
  } catch (error) {
    logger.error(`Error processing Kling video: ${error.message}`);
    apiResponse.internalError(res, "Failed to process video.");
  }
};
