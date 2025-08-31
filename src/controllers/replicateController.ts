import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import db from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/User';
import { Request, Response } from 'express';
import { deductTokensForGeneration, ReplicateStatus } from '../lib/utils';
import { startTraining, createPrediction } from '../services/replicateService';

const REPLICATE_PUBLIC_DIR = path.join(__dirname, '../../public/ai/replicate');

export const trainModel = async (req: Request, res: Response) => {
    const { modelName, triggerWord } = req.body;
    const files = req.files as Express.Multer.File[];
    const user = req.user as User;

    if (!files || files.length < 5) {
        return res.status(400).json({ message: 'At least 5 images are required for training.' });
    }
    if (!modelName || !triggerWord) {
        return res.status(400).json({ message: 'Model name and trigger word are required.' });
    }

    const t = await db.transaction();
    const zipFileName = `${user.id}-${uuidv4()}.zip`;
    const zipFilePath = path.join(REPLICATE_PUBLIC_DIR, zipFileName);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip');

    try {
        await deductTokensForGeneration(user.id, 'video', t); // Using video cost for training

        // Create a zip file of the images
        archive.pipe(output);
        files.forEach(file => {
            archive.file(file.path, { name: file.filename });
        });
        await archive.finalize();

        const zipFileUrl = `${process.env.BACKEND_URL}/ai/replicate/${zipFileName}`;
        const destination: `${string}/${string}` = `${user.username}/${modelName}`;

        const training = await startTraining(destination, zipFileUrl, triggerWord);

        // Update user's replicateModels
        const newModel = {
            id: training.id,
            version: training.version,
            name: modelName,
            status: training.status as ReplicateStatus,
        };

        const currentModels = user.replicateModels || [];
        user.replicateModels = [...currentModels, newModel];
        await user.save({ transaction: t });
        await t.commit();

        res.status(202).json({ message: 'Model training started successfully.', training });
    } catch (error) {
        await t.rollback();
        console.error('Replicate training error:', error);
        res.status(500).json({ message: error.message || 'Failed to start model training.' });
    } finally {
        // Cleanup uploaded files and zip
        files.forEach(file => fs.unlinkSync(file.path));
        if (fs.existsSync(zipFilePath)) {
            fs.unlinkSync(zipFilePath);
        }
    }
};

export const generateImage = async (req: Request, res: Response) => {
    const { modelVersion, prompt } = req.body;
    const user = req.user as User;

    if (!modelVersion || !prompt) {
        return res.status(400).json({ message: 'Model version and prompt are required.' });
    }

    const t = await db.transaction();
    try {
        await deductTokensForGeneration(user.id, 'image', t);
        const job = await createPrediction(modelVersion, prompt, user.id);
        await t.commit();
        res.status(202).json({ message: "Image generation started.", job });
    } catch (error) {
        await t.rollback();
        console.error('Replicate generation error:', error);
        res.status(500).json({ message: error.message || 'Failed to start image generation.' });
    }
};