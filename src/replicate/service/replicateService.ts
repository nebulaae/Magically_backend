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

const FLUX_TRAINER_VERSION = "8b10794665aed907bb98a1a5324cd1d3a8bea0e9b31e65210967fb9c9e2e08ed";

export const createModel = async (
  owner: string,
  name: string,
  description: string,
  visibility: "public" | "private" = "private",
  hardwareSku: string = "cpu",
  coverImageUrl?: string,
) => {
  try {
    const options: any = {
      visibility,
      hardware: hardwareSku,
      description,
    };

    if (coverImageUrl) {
      options.cover_image_url = coverImageUrl;
    }

    const model = await replicate.models.create(owner, name, options);
    logger.info(`Created Replicate model: ${owner}/${name}`);
    return model;
  } catch (error: any) {
    // If model already exists, that's okay - we can continue
    if (error.message?.includes("already exists") || error.response?.status === 409) {
      logger.info(`Model ${owner}/${name} already exists, continuing...`);
      return null;
    }
    logger.error(`Error creating Replicate model: ${error.message}`);
    throw new Error(`Failed to create Replicate model: ${error.message}`);
  }
};

/**
 * Start training a Flux LoRA model
 */
export const startTraining = async (
  destinationModel: `${string}/${string}`,
  trainingDataUrl: string,
  triggerWord: string,
  loraType: "subject" | "style" = "subject",
  steps?: number,
  loraRank?: number,
) => {
  try {
    const input: any = {
      input_images: trainingDataUrl,
      trigger_word: triggerWord,
      lora_type: loraType,
    };

    // Optional parameters
    if (steps) {
      input.steps = steps;
    }
    if (loraRank) {
      input.lora_rank = loraRank;
    }

    logger.info(`Starting training with input: ${JSON.stringify(input, null, 2)}`);

    const training = await replicate.trainings.create(
      "replicate",
      "fast-flux-trainer",
      FLUX_TRAINER_VERSION,
      {
        destination: destinationModel,
        input,
      },
    );

    logger.info(`Training started with ID: ${training.id}`);
    return training;
  } catch (error: any) {
    logger.error(`Error starting Replicate training: ${error.message}`);
    throw new Error(`Failed to start Replicate training: ${error.message}`);
  }
};

/**
 * Get training status
 */
export const getTrainingStatus = async (trainingId: string) => {
  try {
    const training = await replicate.trainings.get(trainingId);
    return training;
  } catch (error: any) {
    logger.error(`Error getting training status: ${error.message}`);
    throw new Error(`Failed to get training status: ${error.message}`);
  }
};

/**
 * Update user with new model information
 */
export const updateUserWithNewModel = async (
  userId: string,
  training: any,
  modelName: string,
  destination: string,
  transaction: Transaction,
) => {
  const user = await replicateRepository.findUserById(userId, transaction);
  if (!user) {
    throw new Error("User not found");
  }

  const newModel = {
    id: training.id,
    version: training.version || null,
    name: modelName,
    destination,
    status: training.status as ReplicateStatus,
    createdAt: new Date().toISOString(),
  };

  const currentModels = user.replicateModels || [];
  const updatedModels = [...currentModels, newModel];
  
  await replicateRepository.updateUser(
    user,
    { replicateModels: updatedModels },
    transaction,
  );

  logger.info(`Updated user ${userId} with new model ${modelName}`);
};

/**
 * Create a prediction (generate image) from trained model
 */
export const createPrediction = async (
  modelDestination: string,
  prompt: string,
  userId: string,
  options?: {
    aspect_ratio?: string;
    num_outputs?: number;
    guidance_scale?: number;
    num_inference_steps?: number;
  }
) => {
  const webhook_url = `${process.env.BACKEND_URL}/api/replicate/webhook`;
  
  try {
    const input: any = {
      prompt,
    };

    // Add optional parameters
    if (options?.aspect_ratio) {
      input.aspect_ratio = options.aspect_ratio;
    }
    if (options?.num_outputs) {
      input.num_outputs = options.num_outputs;
    }
    if (options?.guidance_scale) {
      input.guidance_scale = options.guidance_scale;
    }
    if (options?.num_inference_steps) {
      input.num_inference_steps = options.num_inference_steps;
    }

    // Get the latest version of the model
    const [owner, name] = modelDestination.split('/');
    const model = await replicate.models.get(owner, name);
    
    if (!model.latest_version) {
      throw new Error("Model has no trained version yet. Please wait for training to complete.");
    }

    logger.info(`Creating prediction with model version: ${model.latest_version.id}`);

    const prediction = await replicate.predictions.create({
      version: model.latest_version.id,
      input,
      webhook: webhook_url,
      webhook_events_filter: ["completed"],
    });

    const job = await replicateRepository.createGenerationJob({
      userId,
      service: "replicate",
      serviceTaskId: prediction.id,
      status: "pending",
      prompt,
    });

    logger.info(`Prediction created with ID: ${prediction.id}`);
    return job;
  } catch (error: any) {
    logger.error(`Error creating Replicate prediction: ${error.message}`);
    throw new Error(`Failed to create prediction: ${error.message}`);
  }
};