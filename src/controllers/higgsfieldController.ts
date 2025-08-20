import fs from 'fs';
import { Request, Response } from 'express';
import { Gallery } from '../models/Gallery';
import { Publication } from '../models/Publication';
import {
    generateVideo,
    getVideo,
    downloadVideo
} from '../services/higgsfieldService';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Generate video, poll for completion, and return URL to frontend for preview.
export const generateHiggsfieldVideo = async (req: Request, res: Response) => {
    const {
        enhance_prompt,
        seed,
        width,
        height,
        motion_id,
        prompt,
        model
    } = req.body;

    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
        return res.status(400).json({ message: 'At least one image is required.' });
    }

    try {
        const imageUrls = files.map(file => {
            const filePath = `/ai/higgsfield/${file.filename}`;
            return `${process.env.BACKEND_URL}${filePath}`;
        });

        const apiPayload = {
            motion_id,
            prompt,
            enhance_prompt: enhance_prompt === 'true',
            seed: parseInt(seed, 10),
            width: parseInt(width, 10),
            height: parseInt(height, 10),
            model: model || 'standard'
        };

        const generationResponse = await generateVideo(apiPayload, imageUrls);

        // DO NOT DELETE THE FILES HERE.

        const taskId = generationResponse.id;

        if (!taskId) {
            return res.status(500).json({ message: 'Failed to get a task ID from Higgsfield.' });
        }

        let videoResultUrl;
        let attempts = 0;
        const maxAttempts = 60;

        while (attempts < maxAttempts) {
            await sleep(5000);
            try {
                const statusResponse = await getVideo(taskId);

                if (statusResponse.jobs && statusResponse.jobs[0]) {
                    const job = statusResponse.jobs[0];
                    if (job.status === 'completed') {
                        videoResultUrl = job.result.url;
                        break;
                    } else if (job.status === 'failed') {
                        return res.status(500).json({ message: 'Video generation failed.' });
                    }
                }
            } catch (pollError) {
                console.warn(`Polling attempt ${attempts + 1} for Higgsfield task ${taskId} failed:`, pollError.message);
            }
            attempts++;
        }

        if (!videoResultUrl) {
            return res.status(500).json({ message: 'Video generation timed out.' });
        }

        res.status(200).json({
            message: 'Video generated successfully. Please confirm your action.',
            videoUrl: videoResultUrl,
            prompt: prompt
        });

    } catch (error) {
        console.error('Higgsfield video generation process error:', error);
        res.status(500).json({ message: 'An error occurred during the video generation process.' });
    } finally {
        // This is the correct place to clean up the uploaded files.
        if (files && files.length > 0) {
            files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
    }
};
// Process the video (publish or save) after user confirmation from the frontend.
export const processHiggsfieldVideo = async (req: Request, res: Response) => {
    const { publish, videoUrl, prompt } = req.body;
    const userId = req.user.id;

    if (!videoUrl) {
        return res.status(400).json({ message: 'Video URL is required for processing.' });
    }

    try {
        const downloadedVideoPath = await downloadVideo(videoUrl);

        if (publish === true) {
            const publication = await Publication.create({
                userId,
                content: prompt || 'Generated Video',
                videoUrl: downloadedVideoPath,
                category: "higgsfield"
            });
            res.status(201).json({ message: 'Video published successfully.', publication });
        } else {
            const galleryItem = await Gallery.create({
                userId,
                prompt: prompt || 'Generated Video',
                imageUrl: downloadedVideoPath,
                generationType: 'video-higgsfield',
            });
            res.status(201).json({ message: 'Video saved to your private gallery.', galleryItem });
        }
    } catch (error) {
        console.error('Error processing Higgsfield video:', error);
        res.status(500).json({ message: 'Failed to process video.' });
    }
};