import fs from "fs";
import db from "../../../shared/config/database";
import logger from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as higgsfieldService from "../service/higgsfieldService";
import * as apiResponse from "../../../shared/utils/apiResponse";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateHiggsfieldVideo = async (req: Request, res: Response) => {
  const { enhance_prompt, seed, width, height, motion_id, prompt, model } =
    req.body;
  const files = req.files as Express.Multer.File[];
  const userId = req.user.id;

  if (!files || files.length === 0) {
    return apiResponse.badRequest(res, "At least one image is required.");
  }

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(userId, "video", t);
    const imageUrls = files.map(
      (file) => `${process.env.BACKEND_URL}/ai/higgsfield/${file.filename}`,
    );

    const apiPayload = {
      motion_id,
      prompt,
      enhance_prompt: enhance_prompt === "true",
      seed: parseInt(seed, 10),
      width: parseInt(width, 10),
      height: parseInt(height, 10),
      model: model || "standard",
    };

    const generationResponse = await higgsfieldService.generateVideo(
      apiPayload,
      imageUrls,
    );
    const taskId = generationResponse.id;
    if (!taskId) throw new Error("Failed to get a task ID from Higgsfield.");

    let videoResultUrl;
    for (let attempts = 0; attempts < 60; attempts++) {
      await sleep(5000);
      try {
        const statusResponse = await higgsfieldService.getVideo(taskId);
        const job = statusResponse.jobs?.[0];
        if (job?.status === "completed") {
          videoResultUrl = job.result.url;
          break;
        } else if (job?.status === "failed") {
          throw new Error("Video generation failed at Higgsfield.");
        }
      } catch (pollError) {
        logger.warn(
          `Polling attempt ${attempts + 1} for Higgsfield task ${taskId} failed: ${pollError.message}`,
        );
      }
    }

    if (!videoResultUrl) throw new Error("Video generation timed out.");

    await t.commit();
    apiResponse.success(
      res,
      {
        videoUrl: videoResultUrl,
        prompt: prompt,
      },
      "Video generated successfully. Please confirm your action.",
    );
  } catch (error) {
    await t.rollback();
    logger.error(`Higgsfield video generation process error: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "An error occurred during video generation.",
    );
  } finally {
    files?.forEach((file) => {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    });
  }
};

export const processHiggsfieldVideo = async (req: Request, res: Response) => {
  const { publish, videoUrl, prompt } = req.body;
  const userId = req.user.id;

  if (!videoUrl) {
    return apiResponse.badRequest(res, "Video URL is required for processing.");
  }

  try {
    const result = await higgsfieldService.processFinalVideo(
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
    logger.error(`Error processing Higgsfield video: ${error.message}`);
    apiResponse.internalError(res, "Failed to process video.");
  }
};
