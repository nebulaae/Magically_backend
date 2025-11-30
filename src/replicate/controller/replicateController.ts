import fs from "fs";
import path from "path";
import archiver from "archiver";
import db from "../../../shared/config/database";
import logger from "../../../shared/utils/logger";
import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as replicateRepository from "../repository/replicateRepository";
import * as replicateService from "../service/replicateService";
import * as apiResponse from "../../../shared/utils/apiResponse";

const REPLICATE_PUBLIC_DIR = path.join(
  __dirname,
  "../../../public/ai/replicate",
);

export const trainModel = async (req: Request, res: Response) => {
  const { modelName, triggerWord, loraType = "subject" } = req.body;
  const files = req.files as Express.Multer.File[];
  const user = req.user;

  if (!files || files.length < 10) {
    return apiResponse.badRequest(
      res,
      "At least 10 images are required for training (recommended 10-20).",
    );
  }
  if (!modelName || !triggerWord) {
    return apiResponse.badRequest(
      res,
      "Model name and trigger word are required.",
    );
  }
  if (!["subject", "style"].includes(loraType)) {
    return apiResponse.badRequest(
      res,
      "loraType must be either 'subject' or 'style'.",
    );
  }

  const t = await db.transaction();
  const zipFileName = `${user.id}-${uuidv4()}.zip`;
  const zipFilePath = path.join(REPLICATE_PUBLIC_DIR, zipFileName);

  try {
    await deductTokensForGeneration(user.id, "video", t);

    // Create ZIP file with images
    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(zipFilePath);
      const archive = archiver("zip");
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      files.forEach((file) => archive.file(file.path, { name: file.filename }));
      archive.finalize();
    });

    const zipFileUrl = `${process.env.BACKEND_URL}/ai/replicate/${zipFileName}`;
    const destination: `${string}/${string}` = `${user.id}/${modelName}`;

    // Step 1: Create the model on Replicate
    logger.info(`Creating Replicate model: ${destination}`);
    await replicateService.createModel(
      user.username,
      modelName,
      `Custom ${loraType} model trained with Flux`,
      "private"
    );

    // Step 2: Start training
    logger.info(`Starting training for model: ${destination}`);
    const training = await replicateService.startTraining(
      destination,
      zipFileUrl,
      triggerWord,
      loraType,
    );

    // Step 3: Save model info to database
    await replicateService.updateUserWithNewModel(
      user.id,
      training,
      modelName,
      destination,
      t,
    );

    await t.commit();

    apiResponse.success(
      res,
      {
        training: {
          id: training.id,
          status: training.status,
          destination,
          trigger_word: triggerWord,
        }
      },
      "Model training started successfully.",
      202,
    );
  } catch (error: any) {
    await t.rollback();
    logger.error(`Replicate training error: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "Failed to start model training.",
    );
  } finally {
    files.forEach((file) => {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    });
    if (fs.existsSync(zipFilePath)) {
      fs.unlinkSync(zipFilePath);
    }
  }
};

export const generateImage = async (req: Request, res: Response) => {
  const { modelDestination, prompt, aspectRatio, numOutputs = 1 } = req.body;
  const user = req.user;

  if (!modelDestination || !prompt) {
    return apiResponse.badRequest(
      res,
      "Model destination and prompt are required.",
    );
  }

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(user.id, "image", t);

    const job = await replicateService.createPrediction(
      modelDestination,
      prompt,
      user.id,
      {
        aspect_ratio: aspectRatio,
        num_outputs: numOutputs,
      }
    );

    await t.commit();
    apiResponse.success(res, { job }, "Image generation started.", 202);
  } catch (error: any) {
    await t.rollback();
    logger.error(`Replicate generation error: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "Failed to start image generation.",
    );
  }
};

export const getTrainingStatus = async (req: Request, res: Response) => {
  const { trainingId } = req.params;
  const user = req.user;

  try {
    const training = await replicateService.getTrainingStatus(trainingId);
    apiResponse.success(res, { training }, "Training status retrieved.");
  } catch (error: any) {
    logger.error(`Error getting training status: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "Failed to get training status.",
    );
  }
};

export const getUserModels = async (req: Request, res: Response) => {
  const user = req.user;

  try {
    const models = user.replicateModels || [];

    // Optionally fetch fresh status from Replicate
    const modelsWithStatus = await Promise.all(
      models.map(async (model: any) => {
        try {
          if (model.id && model.status !== "succeeded") {
            const training = await replicateService.getTrainingStatus(model.id);
            return {
              ...model,
              status: training.status,
              version: training.version || model.version,
            };
          }
          return model;
        } catch (error) {
          return model;
        }
      })
    );

    apiResponse.success(res, { models: modelsWithStatus }, "User models retrieved.");
  } catch (error: any) {
    logger.error(`Error getting user models: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "Failed to get user models.",
    );
  }
};

export const deleteModel = async (req: Request, res: Response) => {
  const { modelId } = req.params;
  const user = req.user;

  const t = await db.transaction();
  try {
    const models = user.replicateModels || [];
    const updatedModels = models.filter((m: any) => m.id !== modelId);

    await replicateRepository.updateUser(
      user,
      { replicateModels: updatedModels },
      t,
    );

    await t.commit();
    apiResponse.success(res, {}, "Model deleted successfully.");
  } catch (error: any) {
    await t.rollback();
    logger.error(`Error deleting model: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "Failed to delete model.",
    );
  }
};