import fs from "fs";
import db from "../../../shared/config/database";
import logger from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as higgsfieldService from "../service/higgsfieldService";
import * as apiResponse from "../../../shared/utils/apiResponse";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

    let videoUrl: string | null = null;
    for (let attempts = 0; attempts < 60; attempts++) {
      await sleep(5000);
      const statusResponse = await higgsfieldService.getVideoStatus(taskId);
      const status = statusResponse?.data?.status;
      if (status === "completed") {
        videoUrl =
          statusResponse?.data?.output?.video_url ||
          statusResponse?.output?.video_url;
        break;
      } else if (status === "failed") {
        throw new Error("Video generation failed at Higgsfield.");
      }
    }

    if (!videoUrl) {
      throw new Error("Video generation timed out or no video returned.");
    }

    await t.commit();
    apiResponse.success(
      res,
      { videoUrl, prompt },
      "Video generated successfully."
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

export const processHiggsfieldVideo = async (req: Request, res: Response) => {
  const { publish, videoUrl, prompt } = req.body;
  const userId = req.user.id;

  if (!videoUrl) {
    return apiResponse.badRequest(res, "Video URL is required.");
  }

  try {
    const result = await higgsfieldService.processFinalVideo(
      publish,
      userId,
      videoUrl,
      prompt
    );
    const message = publish
      ? "Video published successfully."
      : "Video saved to your private gallery.";
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
