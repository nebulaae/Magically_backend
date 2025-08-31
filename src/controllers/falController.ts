import fs from 'fs';
import db from '../config/database';
import { Gallery } from '../models/Gallery';
import { Request, Response } from 'express';
import { Publication } from '../models/Publication';
import { deductTokensForGeneration } from '../lib/utils';
import { processWithFalClient, downloadFalImage } from '../services/falService';

/**
 * @description Step 1: Post-process an image with Fal AI and return its URL for preview.
 * This now handles file uploads and uses the @fal-ai/client library.
 */
export const postProcessFalImage = async (req: Request, res: Response) => {
    const { ...processingParams } = req.body;
    const file = req.file;
    const userId = req.user.id;
    const modelId = 'fal-ai/post-processing';

    if (!file) {
        return res.status(400).json({ message: 'An image file is required for post-processing.' });
    }

    const t = await db.transaction();
    try {
        await deductTokensForGeneration(userId, 'image', t);
        const imageUrl = `${process.env.BACKEND_URL}/ai/fal/${file.filename}`;

        // FIX: Ensure numeric parameters are parsed correctly from the request body.
        const numericFields = [
            'grain_intensity', 'grain_scale', 'gamma', 'blur_radius', 'blur_sigma',
            'vignette_strength', 'parabolize_coeff', 'vertex_x', 'vertex_y', 'tint_strength',
            'dissolve_factor', 'dodge_burn_intensity', 'glow_intensity', 'glow_radius',
            'sharpen_radius', 'sharpen_alpha', 'noise_radius', 'preserve_edges',
            'smart_sharpen_strength', 'smart_sharpen_ratio', 'cas_amount',
            'solarize_threshold', 'desaturate_factor'
        ];

        const parsedParams = { ...processingParams };
        for (const key of numericFields) {
            if (parsedParams[key] !== undefined && typeof parsedParams[key] === 'string') {
                parsedParams[key] = parseFloat(parsedParams[key]);
            }
        }

        const input = {
            image_url: imageUrl,
            ...parsedParams
        };

        // REFACTORED: Replaced direct API calls with the new client-based service function.
        // The client handles polling internally.
        const result = await processWithFalClient(modelId, input);

        if (!result || !result.images || result.images.length === 0) {
            throw new Error('Image post-processing failed to return an image.');
        }

        const outputImageUrl = result.images[0].url;

        await t.commit();
        res.status(200).json({
            message: 'Image processed successfully. Please confirm your action.',
            imageUrl: outputImageUrl,
            prompt: 'Post-processed image'
        });
    } catch (error) {
        await t.rollback();
        console.error('Fal AI post-processing error:', error);
        res.status(500).json({ message: error.message || 'An error occurred during the image post-processing.' });
    } finally {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
    }
};


/**
 * @description Step 2: Process any Fal AI image (publish or save).
 */
export const processFalImage = async (req: Request, res: Response) => {
    const { publish, imageUrl, prompt } = req.body;
    const userId = req.user.id;

    if (!imageUrl) {
        return res.status(400).json({ message: 'Image URL is required for processing.' });
    }

    try {
        const localImagePath = await downloadFalImage(imageUrl);
        if (publish === true) {
            const publication = await Publication.create({
                userId,
                content: prompt || 'Generated Image via Fal AI',
                imageUrl: localImagePath,
                category: "fal-ai"
            });
            res.status(201).json({ message: 'Image published successfully.', publication });
        } else {
            const galleryItem = await Gallery.create({
                userId,
                prompt: prompt || 'Generated Image via Fal AI',
                imageUrl: localImagePath,
                generationType: 'image-fal',
            });
            res.status(201).json({ message: 'Image saved to your private gallery.', galleryItem });
        }
    } catch (error) {
        console.error('Error processing Fal AI image:', error);
        res.status(500).json({ message: 'Failed to process image.' });
    }
};