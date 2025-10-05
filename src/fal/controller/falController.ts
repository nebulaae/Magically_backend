import fs from "fs";
import db from "../../../shared/config/database";
import logger from "../../../shared/utils/logger";
import * as falService from "../service/falService";
import * as apiResponse from "../../../shared/utils/apiResponse";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";

export const postProcessFalImage = async (req: Request, res: Response) => {
  const { ...processingParams } = req.body;
  const file = req.file;
  const userId = req.user.id;
  const modelId = "fal-ai/post-processing";

  if (!file) {
    return apiResponse.badRequest(
      res,
      "An image file is required for post-processing.",
    );
  }

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(userId, "image", t);
    const imageUrl = `${process.env.BACKEND_URL}/ai/fal/${file.filename}`;

    const numericFields = [
      "grain_intensity",
      "grain_scale",
      "gamma",
      "blur_radius",
      "blur_sigma",
      "vignette_strength",
      "parabolize_coeff",
      "vertex_x",
      "vertex_y",
      "tint_strength",
      "dissolve_factor",
      "dodge_burn_intensity",
      "glow_intensity",
      "glow_radius",
      "sharpen_radius",
      "sharpen_alpha",
      "noise_radius",
      "preserve_edges",
      "smart_sharpen_strength",
      "smart_sharpen_ratio",
      "cas_amount",
      "solarize_threshold",
      "desaturate_factor",
    ];

    const parsedParams = { ...processingParams };
    numericFields.forEach((key) => {
      if (
        parsedParams[key] !== undefined &&
        typeof parsedParams[key] === "string"
      ) {
        parsedParams[key] = parseFloat(parsedParams[key]);
      }
    });

    const input = { image_url: imageUrl, ...parsedParams };
    const result = await falService.processWithFalClient(modelId, input);

    if (!result?.images?.length) {
      throw new Error("Image post-processing failed to return an image.");
    }

    await t.commit();
    apiResponse.success(
      res,
      {
        imageUrl: result.images[0].url,
        prompt: "Post-processed image",
      },
      "Image processed successfully. Please confirm your action.",
    );
  } catch (error) {
    await t.rollback();
    logger.error(`Fal AI post-processing error: ${error.message}`);
    apiResponse.internalError(
      res,
      "An error occurred during the image post-processing.",
    );
  } finally {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }
};

export const processFalImage = async (req: Request, res: Response) => {
  const { publish, imageUrl, prompt } = req.body;
  const userId = req.user.id;

  if (!imageUrl) {
    return apiResponse.badRequest(res, "Image URL is required for processing.");
  }

  try {
    const result = await falService.processFinalImage(
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
    logger.error(`Error processing Fal AI image: ${error.message}`);
    apiResponse.internalError(res, "Failed to process image.");
  }
};
