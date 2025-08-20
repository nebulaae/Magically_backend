import fs from 'fs';
import { Request, Response } from 'express';
import { Gallery } from '../models/Gallery';
import { Publication } from '../models/Publication';
import {
    generateKlingVideo,
    getKlingVideoStatus,
    downloadKlingVideo
} from '../services/klingService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generate Kling video, poll for completion, and return URL for preview.
export const generateAndPollKlingVideo = async (req: Request, res: Response) => {
    const {
        model,
        prompt,
        duration,
        aspect_ratio,
        negative_prompt,
        effect
    } = req.body;

    const file = req.file;

    if (!file) {
        return res.status(400).json({ message: 'An image is required for Kling generation.' });
    }

    try {
        // NOTE: The path for the public URL must match how you serve static files in index.ts
        const imageUrl = `${process.env.BACKEND_URL}/ai/kling/${file.filename}`;

        const payload = {
            model: model || '2.1-master',
            image_url: imageUrl,
            prompt,
            duration: parseInt(duration, 10) || 5,
            aspect_ratio: aspect_ratio || '16:9',
            negative_prompt,
            effect
        };

        const generationResponse = await generateKlingVideo(payload);

        // DO NOT DELETE THE FILE HERE. The AI service needs to download it.

        if (!generationResponse.success || !generationResponse.data.id) {
            return res.status(500).json({ message: 'Failed to get a task ID from Kling.', details: generationResponse });
        }

        const taskId = generationResponse.data.id;
        let videoUrl: string | null = null;
        let attempts = 0;
        const maxAttempts = 60;

        while (attempts < maxAttempts) {
            await sleep(5000);
            try {
                const statusResponse = await getKlingVideoStatus(taskId);

                if (statusResponse.success && statusResponse.data.status === 'completed') {
                    videoUrl = statusResponse.data.video_url;
                    break;
                } else if (!statusResponse.success || statusResponse.data.status === 'failed') {
                    return res.status(500).json({ message: 'Kling video generation failed.', details: statusResponse });
                }
            } catch (pollError) {
                console.warn(`Polling attempt ${attempts + 1} for Kling task ${taskId} failed:`, pollError.message);
            }
            attempts++;
        }

        if (!videoUrl) {
            return res.status(500).json({ message: 'Kling video generation timed out.' });
        }

        res.status(200).json({
            message: 'Video generated successfully. Please confirm your action.',
            videoUrl: videoUrl,
            prompt: prompt
        });

    } catch (error) {
        console.error('Kling video generation process error:', error);
        res.status(500).json({ message: 'An error occurred during the Kling video generation process.' });
    } finally {
        // This block will run after the try/catch is complete.
        // This is the correct place to clean up the uploaded file.
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
    }
};

// Process the Kling video (publish or save) after user confirmation.
export const processKlingVideo = async (req: Request, res: Response) => {
    const { publish, videoUrl, prompt } = req.body;
    const userId = req.user.id;

    if (!videoUrl) {
        return res.status(400).json({ message: 'Video URL is required for processing.' });
    }

    try {
        const downloadedVideoPath = await downloadKlingVideo(videoUrl);

        if (publish === true) {
            const publication = await Publication.create({
                userId,
                content: prompt || 'Generated Video',
                videoUrl: downloadedVideoPath,
                category: "kling"
            });
            res.status(201).json({ message: 'Video published successfully.', publication });
        } else {
            const galleryItem = await Gallery.create({
                userId,
                prompt: prompt || 'Generated Video',
                imageUrl: downloadedVideoPath,
                generationType: 'video-kling',
            });
            res.status(201).json({ message: 'Video saved to your private gallery.', galleryItem });
        }
    } catch (error) {
        console.error('Error processing Kling video:', error);
        res.status(500).json({ message: 'Failed to process video.' });
    }
};