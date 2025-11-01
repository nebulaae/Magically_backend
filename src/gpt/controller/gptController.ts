import db from "../../../shared/config/database";
import { logger } from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as gptService from "../service/gptService";
import * as apiResponse from "../../../shared/utils/apiResponse";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const generateImage = async (req: Request, res: Response) => {
  const { prompt } = req.body;
  const userId = req.user.id;

  if (!prompt) {
    return apiResponse.badRequest(res, "Prompt is required.");
  }

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(userId, "image", t);

    const gptResponse = await gptService.generateGptImage(prompt);

    // If API returns immediate content (like choices array), handle that first
    let finalImageUrl: string | null = null;
    try {
      if (gptResponse?.choices && Array.isArray(gptResponse.choices) && gptResponse.choices.length) {
        const rawImageUrl = gptResponse.choices[0]?.message?.content;
        finalImageUrl = gptService.extractImageUrl(rawImageUrl);
      }
    } catch (e) {
      finalImageUrl = null;
    }

    // If no immediate URL, try to extract task id and poll status endpoint
    if (!finalImageUrl) {
      let taskId: string | undefined;
      try {
        if (gptResponse == null) taskId = undefined;
        else if (typeof gptResponse === "string") {
          const parsed = JSON.parse(gptResponse);
          taskId = parsed?.data_id || parsed?.task_id || parsed?.data?.task_id;
        } else {
          taskId =
            gptResponse?.data_id ||
            gptResponse?.task_id ||
            gptResponse?.data?.task_id ||
            gptResponse?.data?.data_id ||
            gptResponse?.data?.id;
        }
      } catch (e) {
        taskId = undefined;
      }

      if (!taskId) {
        const shortResp = JSON.stringify(gptResponse).slice(0, 1000);
        throw new Error(`Failed to get a task ID from GPT image API. Response: ${shortResp}`);
      }

      // Poll for status
      for (let attempts = 0; attempts < 60; attempts++) {
        await sleep(5000);
        try {
          const statusResponse = await gptService.getGptImageStatus(taskId);
          const status = statusResponse?.data?.status || statusResponse?.status;
          if (status === "completed") {
            finalImageUrl =
              statusResponse?.data?.output?.image_url ||
              statusResponse?.data?.image_url ||
              null;
            break;
          } else if (status === "failed") {
            const errMsg = statusResponse?.data?.error?.message || "GPT image generation failed.";
            throw new Error(errMsg);
          }
        } catch (pollError: any) {
          logger.warn(`Polling attempt ${attempts + 1} for GPT task ${taskId} failed: ${pollError.message}`);
        }
      }
    }

    console.log(gptResponse);

    if (!finalImageUrl) {
      throw new Error("API did not return an image URL or generation timed out.");
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
    logger.error(`GPT image generation process error: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "An error occurred during the image generation process.",
    );
  }
};

export const processImage = async (req: Request, res: Response) => {
  const { publish, imageUrl, prompt } = req.body;
  const userId = req.user.id;

  if (!imageUrl) {
    return apiResponse.badRequest(res, "Image URL is required for processing.");
  }

  try {
    const result = await gptService.processFinalImage(
      publish,
      userId,
      imageUrl,
      prompt,
    );
    const message = publish
      ? "Image published successfully."
      : "Image saved to your private gallery.";
    apiResponse.success(res, result, message, 201);
  } catch (error) {
    logger.error(`Error processing GPT image: ${error.message}`);
    apiResponse.internalError(res, "Failed to process image.");
  }
};
