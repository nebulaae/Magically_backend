import dotenv from "dotenv";
import Replicate from "replicate";
import logger from "../../../shared/utils/logger";
import { Transaction } from "sequelize";
import { ReplicateStatus } from "../../../shared/types/types";
import * as replicateRepository from "../repository/replicateRepository";

dotenv.config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API,
});

export const startTraining = async (
  destinationModel: `${string}/${string}`,
  trainingDataUrl: string,
  triggerWord: string,
) => {
  try {
    return await replicate.trainings.create(
      "replicate",
      "sdxl-lora-trainer",
      "1892d3738096417775edd773e72643a18a2f4702b8f13459e7a8cf41f3e79e60",
      {
        destination: destinationModel,
        input: { input_images: trainingDataUrl, token_string: triggerWord },
      },
    );
  } catch (error) {
    logger.error(`Error starting Replicate training: ${error.message}`);
    throw new Error("Failed to start Replicate training job.");
  }
};

export const updateUserWithNewModel = async (
  userId: string,
  training: any,
  modelName: string,
  transaction: Transaction,
) => {
  const user = await replicateRepository.findUserById(userId, transaction);
  if (!user) {
    throw new Error("User not found");
  }

  const newModel = {
    id: training.id,
    version: training.version,
    name: modelName,
    status: training.status as ReplicateStatus,
  };

  const currentModels = user.replicateModels || [];
  const updatedModels = [...currentModels, newModel];
  await replicateRepository.updateUser(
    user,
    { replicateModels: updatedModels },
    transaction,
  );
};

export const createPrediction = async (
  modelVersion: string,
  prompt: string,
  userId: string,
) => {
  const webhook_url = `${process.env.BACKEND_URL}/api/replicate/webhook`;
  try {
    const prediction = await replicate.predictions.create({
      version: modelVersion,
      input: { prompt },
      webhook: webhook_url,
      webhook_events_filter: ["completed"],
    });

    return await replicateRepository.createGenerationJob({
      userId,
      service: "replicate",
      serviceTaskId: prediction.id,
      status: "pending",
      prompt,
    });
  } catch (error) {
    logger.error(`Error creating Replicate prediction: ${error.message}`);
    throw new Error("Failed to create prediction.");
  }
};
