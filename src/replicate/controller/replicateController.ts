import fs from "fs";
import path from "path";
import archiver from "archiver";
import db from "../../../shared/config/database";
import logger from "../../../shared/utils/logger";
import { v4 as uuidv4 } from "uuid";
import { Request, Response } from "express";
import { deductTokensForGeneration } from "../../../shared/utils/userActions";
import * as replicateService from "../service/replicateService";
import * as apiResponse from "../../../shared/utils/apiResponse";

const REPLICATE_PUBLIC_DIR = path.join(
  __dirname,
  "../../../public/ai/replicate",
);

export const trainModel = async (req: Request, res: Response) => {
  const { modelName, triggerWord } = req.body;
  const files = req.files as Express.Multer.File[];
  const user = req.user;

  if (!files || files.length < 5) {
    return apiResponse.badRequest(
      res,
      "At least 5 images are required for training.",
    );
  }
  if (!modelName || !triggerWord) {
    return apiResponse.badRequest(
      res,
      "Model name and trigger word are required.",
    );
  }

  const t = await db.transaction();
  const zipFileName = `${user.id}-${uuidv4()}.zip`;
  const zipFilePath = path.join(REPLICATE_PUBLIC_DIR, zipFileName);

  try {
    await deductTokensForGeneration(user.id, "video", t); // Using video cost for training

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
    const destination: `${string}/${string}` = `${user.username}/${modelName}`;

    const training = await replicateService.startTraining(
      destination,
      zipFileUrl,
      triggerWord,
    );
    await replicateService.updateUserWithNewModel(
      user.id,
      training,
      modelName,
      t,
    );

    await t.commit();

    apiResponse.success(
      res,
      { training },
      "Model training started successfully.",
      202,
    );
  } catch (error) {
    await t.rollback();
    logger.error(`Replicate training error: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "Failed to start model training.",
    );
  } finally {
    files.forEach((file) => fs.unlinkSync(file.path));
    if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
  }
};

export const generateImage = async (req: Request, res: Response) => {
  const { modelVersion, prompt } = req.body;
  const user = req.user;

  if (!modelVersion || !prompt) {
    return apiResponse.badRequest(
      res,
      "Model version and prompt are required.",
    );
  }

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(user.id, "image", t);
    const job = await replicateService.createPrediction(
      modelVersion,
      prompt,
      user.id,
    );
    await t.commit();
    apiResponse.success(res, { job }, "Image generation started.", 202);
  } catch (error) {
    await t.rollback();
    logger.error(`Replicate generation error: ${error.message}`);
    apiResponse.internalError(
      res,
      error.message || "Failed to start image generation.",
    );
  }
};
