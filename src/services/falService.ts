import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { fal } from '@fal-ai/client';

dotenv.config()

fal.config({
    credentials: process.env.FAL_API
});

/**
 * @description Processes an image using the @fal-ai/client library.
 * This function handles the subscription and waits for the final result.
 * @param modelId The ID of the Fal AI model to use.
 * @param input The input payload for the model.
 * @returns The result from the Fal AI model.
 */
export const processWithFalClient = async (modelId: string, input: any) => {
    try {
        console.log(`Submitting job to Fal AI model: ${modelId}`);
        const result: any = await fal.subscribe(modelId, {
            input: input,
            logs: true, // Enable server-side logging for debugging
            onQueueUpdate: (update) => {
                if (update.status === "IN_PROGRESS") {
                    update.logs.map((log) => console.log(`[Fal AI Log]: ${log.message}`));
                }
            },
        });
        console.log('Fal AI job completed successfully.');
        return result;
    } catch (error) {
        console.error('Error during Fal AI client subscription:', error);
        throw new Error('Failed to process request with Fal AI client.');
    }
};


export const downloadFalImage = async (imageUrl: string): Promise<string> => {
    const imageDir = path.join(__dirname, `../../public/images/fal`);
    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
    }
    const filename = `${uuidv4()}.png`;
    const outputPath = path.join(imageDir, filename);

    try {
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream',
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(`/images/fal/${filename}`));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Error downloading image to fal:`, error);
        throw new Error('Failed to download generated image.');
    }
};