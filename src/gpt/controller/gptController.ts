import db from "../../../shared/config/database";
import { logger } from "../../../shared/utils/logger";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as gptService from "../service/gptService";
import * as apiResponse from "../../../shared/utils/apiResponse";

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
    const rawImageUrl = gptResponse.choices[0].message.content;

    if (!rawImageUrl) {
      throw new Error("API did not return an image URL.");
    }
    const finalImageUrl = gptService.extractImageUrl(rawImageUrl);

    if (!finalImageUrl) {
      throw new Error("Could not parse the image URL from the API response.");
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
