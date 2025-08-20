import { Gallery } from '../models/Gallery';
import { Request, Response } from 'express';
import { Publication } from '../models/Publication';
import { generateGptImage, downloadImage } from '../services/gptService';

// Generate an image and return its URL for preview.
export const generateImage = async (req: Request, res: Response) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ message: 'Prompt is required.' });
    }

    try {
        const gptResponse = await generateGptImage(prompt);
        // Assuming the image URL is in this path, adjust if necessary
        const imageUrl = gptResponse.choices[0].message.content;

        if (!imageUrl) {
            return res.status(500).json({ message: 'API did not return an image URL.' });
        }

        // const localImagePath = await downloadImage(imageUrl, 'gpt');

        res.status(200).json({
            message: 'Image generated successfully. Please confirm your action.',
            imageUrl: imageUrl,
            prompt: prompt
        });
    } catch (error) {
        console.error('GPT image generation process error:', error);
        res.status(500).json({ message: 'An error occurred during the image generation process.' });
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
        if (publish === true) {
            const publication = await Publication.create({
                userId,
                content: prompt || 'Generated Image via GPT-4o',
                imageUrl: imageUrl,
                category: "gpt"
            });
            res.status(201).json({ message: 'Image published successfully.', publication });
        } else {
            const galleryItem = await Gallery.create({
                userId,
                prompt: prompt || 'Generated Image via GPT-4o',
                imageUrl: imageUrl,
                generationType: 'image-gpt',
            });
            res.status(201).json({ message: 'Image saved to your private gallery.', galleryItem });
        }
    } catch (error) {
        console.error('Error processing GPT image:', error);
        res.status(500).json({ message: 'Failed to process image.' });
    }
};
