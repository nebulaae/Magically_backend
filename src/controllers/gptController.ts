import db from '../config/database';
import { Gallery } from '../models/Gallery';
import { Request, Response } from 'express';
import { Publication } from '../models/Publication';
import { deductTokensForGeneration } from '../lib/utils';
import { generateGptImage, downloadImage, extractImageUrl } from '../services/gptService';

// Generate an image and return its URL for preview.
export const generateImage = async (req: Request, res: Response) => {
    const { prompt } = req.body;
    const userId = req.user.id;

    if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required.' });
    }

    const t = await db.transaction();
    try {
        // Deduct tokens before starting generation
        await deductTokensForGeneration(userId, 'image', t);

        const gptResponse = await generateGptImage(prompt);
        const rawImageUrl = gptResponse.choices[0].message.content;

        if (!rawImageUrl) {
            await t.rollback();
            return res.status(500).json({ message: 'API did not return an image URL.' });
        }

        // The actual image URL is often embedded in markdown, so we extract it.
        const finalImageUrl = extractImageUrl(rawImageUrl);

        if (!finalImageUrl) {
            await t.rollback();
            return res.status(500).json({ message: 'Could not parse the image URL from the API response.' });
        }

        await t.commit();
        res.status(200).json({
            message: 'Image generated successfully. Please confirm your action.',
            imageUrl: finalImageUrl, // Return the clean URL
            prompt: prompt
        });
    } catch (error) {
        await t.rollback();
        console.error('GPT image generation process error:', error);
        res.status(500).json({ message: error.message || 'An error occurred during the image generation process.' });
    }
};

// Process the image (publish or save) after user confirmation.
export const processImage = async (req: Request, res: Response) => {
    const { publish, imageUrl, prompt } = req.body;
    const userId = req.user.id;

    if (!imageUrl) {
        return res.status(400).json({ message: 'Image URL is required for processing.' });
    }

    try {
        // Download the image from the remote URL to our server
        const localImagePath = await downloadImage(imageUrl, 'gpt');

        if (publish === true) {
            const publication = await Publication.create({
                userId,
                content: prompt || 'Generated Image via GPT-4o',
                imageUrl: localImagePath, // Save the local path
                category: "gpt"
            });
            res.status(201).json({ message: 'Image published successfully.', publication });
        } else {
            const galleryItem = await Gallery.create({
                userId,
                prompt: prompt || 'Generated Image via GPT-4o',
                imageUrl: localImagePath, // Save the local path
                generationType: 'image-gpt',
            });
            res.status(201).json({ message: 'Image saved to your private gallery.', galleryItem });
        }
    } catch (error) {
        console.error('Error processing GPT image:', error);
        res.status(500).json({ message: 'Failed to process image.' });
    }
};