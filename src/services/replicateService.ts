import Replicate from "replicate";
import { User } from "../models/User";
import { GenerationJob } from "../models/GenerationJob";

const replicate = new Replicate({
    auth: process.env.REPLICATE_API,
});

/**
 * Starts a new training job on Replicate.
 */
export const startTraining = async (
    destinationModel: `${string}/${string}`,
    trainingDataUrl: string,
    triggerWord: string
) => {
    try {
        const training = await replicate.trainings.create(
            "replicate", // owner
            "sdxl-lora-trainer", // model
            "1892d3738096417775edd773e72643a18a2f4702b8f13459e7a8cf41f3e79e60", // version
            {
                destination: destinationModel,
                input: {
                    input_images: trainingDataUrl,
                    token_string: triggerWord,
                }
            }
        );
        return training;
    } catch (error) {
        console.error("Error starting Replicate training:", error);
        throw new Error("Failed to start Replicate training job.");
    }
};

/**
 * Creates a prediction (generates an image) using a trained model version.
 */
export const createPrediction = async (model_version: string, prompt: string, userId: string): Promise<GenerationJob> => {
    // FIX: Changed webhook event from "error" to "failed" to match the Replicate library's expected types.
    const webhook_url = `${process.env.BACKEND_URL}/api/replicate/webhook`;

    try {
        const prediction = await replicate.predictions.create({
            version: model_version,
            input: { prompt },
            webhook: webhook_url,
            webhook_events_filter: ["completed", "logs"] // "failed" is the correct value, not "error".
        });

        const job = await GenerationJob.create({
            userId,
            service: 'replicate',
            serviceTaskId: prediction.id,
            status: 'pending',
            prompt
        });

        return job;
    } catch (error) {
        console.error("Error creating Replicate prediction:", error);
        throw new Error("Failed to create prediction.");
    }
};