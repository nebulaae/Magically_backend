import fs  from 'fs';
import { Gallery } from '../models/Gallery';
import { Request, Response } from 'express';
import { Publication } from '../models/Publication';
import { submitFalRequest, getFalResult } from '../services/falService';
import { downloadImage as downloadFalImage } from '../services/gptService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @description Step 1: Generate an image with Fal AI and return its URL for preview.
 */
export const generateFalImage = async (req: Request, res: Response) => {
    const { prompt, modelId } = req.body;
    const file = req.file;

    if (!prompt || !modelId) {
        return res.status(400).json({ message: 'Prompt and modelId are required.' });
    }
    if (!file) {
        return res.status(400).json({ message: 'An input image is required for this model.' });
    }

    try {
        const imageUrl = `${process.env.BACKEND_URL}/ai/fal/${file.filename}`;
        const input = {
            // This input structure is an example. Adjust it based on the specific Fal model.
            prompt: prompt,
            image_url: imageUrl
        };

        const initialResponse = await submitFalRequest(modelId, input);
        const requestId = initialResponse.request_id;

        let result;
        let attempts = 0;
        const maxAttempts = 60;

        while (attempts < maxAttempts) {
            await sleep(3000); // Poll every 3 seconds
            const statusResponse = await getFalResult(modelId, requestId);
            if (statusResponse.status === 'COMPLETED') {
                result = statusResponse.result;
                break;
            } else if (statusResponse.status === 'ERROR') {
                throw new Error(statusResponse.error || 'Fal AI generation failed.');
            }
            attempts++;
        }

        if (!result) {
            return res.status(500).json({ message: 'Image generation timed out.' });
        }

        // Assuming the result contains an array of images. Adjust if necessary.
        const outputImageUrl = result.images[0].url;
        const localImagePath = await downloadFalImage(outputImageUrl, 'fal');

        res.status(200).json({
            message: 'Image generated successfully. Please confirm your action.',
            imageUrl: localImagePath,
            prompt: prompt
        });

    } catch (error) {
        console.error('Fal AI image generation process error:', error);
        res.status(500).json({ message: 'An error occurred during the image generation process.' });
    } finally {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
    }
};

/**
 * @description Step 2: Process the Fal AI image (publish or save).
 */
export const processFalImage = async (req: Request, res: Response) => {
    const { publish, imageUrl, prompt } = req.body;
    const userId = req.user.id;

    if (!imageUrl) {
        return res.status(400).json({ message: 'Image URL is required for processing.' });
    }

    try {
        if (publish === true) {
            const publication = await Publication.create({
                userId,
                content: prompt || 'Generated Image via Fal AI',
                imageUrl: imageUrl,
                category: "fal-ai"
            });
            res.status(201).json({ message: 'Image published successfully.', publication });
        } else {
            const galleryItem = await Gallery.create({
                userId,
                prompt: prompt || 'Generated Image via Fal AI',
                imageUrl: imageUrl,
                generationType: 'image-fal',
            });
            res.status(201).json({ message: 'Image saved to your private gallery.', galleryItem });
        }
    } catch (error) {
        console.error('Error processing Fal AI image:', error);
        res.status(500).json({ message: 'Failed to process image.' });
    }
};