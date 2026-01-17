import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { Transaction } from "sequelize";
import { logger } from "../../../shared/utils/logger";
import * as fluxRepository from "../repository/fluxRepository";
import { FluxModel } from "../models/FluxModel";

dotenv.config();

const API_KEY = process.env.FLUX_API_KEY;
const BASE_URL = "https://api.unifically.com/flux.2-max";
const BACKEND_URL = process.env.BACKEND_URL;

// --- CRUD Модели Flux ---

export const createFluxModel = async (
    userId: string,
    name: string,
    description: string,
    instruction: string,
    files: Express.Multer.File[]
) => {
    const imagePaths = files.map((f) => `/ai/flux/${f.filename}`);
    return await FluxModel.create({
        userId,
        name,
        description,
        instruction,
        imagePaths,
    });
};

export const updateFluxModel = async (
    userId: string,
    modelId: string,
    data: { name?: string; description?: string; instruction?: string },
    files?: Express.Multer.File[]
) => {
    const model = await FluxModel.findByPk(modelId);
    if (!model) throw new Error("Flux Model not found");
    if (model.userId !== userId) throw new Error("Access denied");

    if (files && files.length > 0) {
        model.imagePaths.forEach((relativePath) => {
            const fullPath = path.join(__dirname, "../../../public", relativePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        });
        model.imagePaths = files.map((f) => `/ai/flux/${f.filename}`);
    }

    if (data.name) model.name = data.name;
    if (data.description !== undefined) model.description = data.description;
    if (data.instruction !== undefined) model.instruction = data.instruction;

    return await model.save();
};

export const deleteFluxModel = async (userId: string, modelId: string) => {
    const model = await FluxModel.findByPk(modelId);
    if (!model) throw new Error("Flux Model not found");
    if (model.userId !== userId) throw new Error("Access denied");

    // Удаляем файлы
    model.imagePaths.forEach((relativePath) => {
        const fullPath = path.join(__dirname, "../../../public", relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    });

    return await model.destroy();
};

export const getUserFluxModels = async (userId: string) => {
    return await FluxModel.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
    });
};

export const getFluxModelById = async (userId: string, modelId: string) => {
    const model = await FluxModel.findByPk(modelId);
    if (model && model.userId === userId) {
        return model;
    }
    return null;
};

// --- Генерация (Unifically) ---

export const generateFluxImage = async (
    userId: string,
    modelId: string,
    prompt: string,
    aspect_ratio: string = "1:1"
) => {
    const model = await FluxModel.findByPk(modelId);
    if (!model) throw new Error("Flux Model not found");

    const imageUrls = model.imagePaths.map((p) => `${BACKEND_URL}${p}`);

    const finalPrompt = model.instruction
        ? `${model.instruction}. ${prompt}`
        : prompt;

    const payload = {
        prompt: finalPrompt,
        image_urls: imageUrls,
        aspect_ratio: aspect_ratio,
        quality: "1K",
    };

    try {
        logger.info(`Starting Flux generation with payload: ${JSON.stringify(payload, null, 2)}`);

        const response = await axios.post(`${BASE_URL}/generate`, payload, {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
        });

        return response.data;

    } catch (error: any) {
        logger.error(`Flux Unifically API Error: ${error.message}`);
        if (error.response?.data) {
            logger.error(`Response data: ${error.response.data}`);
        }
        throw new Error("Failed to start Flux generation");
    }
};

export const getFluxImageStatus = async (taskId: string) => {
    try {
        const response = await axios.get(`${BASE_URL}/status/${taskId}`, {
            headers: { Authorization: `Bearer ${API_KEY}` },
        });
        return response.data;
    } catch (error) {
        return null;
    }
};

// ... (функции downloadImage и processFinalImage остаются как были) ...
const downloadImage = async (imageUrl: string): Promise<string> => {
    const imageDir = path.join(__dirname, `../../../public/images/flux`);
    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
    }
    const filename = `${uuidv4()}.png`;
    const outputPath = path.join(imageDir, filename);
    try {
        const response = await axios({
            method: "GET",
            url: imageUrl,
            responseType: "stream",
        });
        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => resolve(`/images/flux/${filename}`));
            writer.on("error", reject);
        });
    } catch (error: any) {
        logger.error(`Error downloading image to flux: ${error.message}`);
        throw new Error("Failed to download generated image.");
    }
};

export const processFinalImage = async (
    publish: boolean,
    userId: string,
    imageUrl: string,
    prompt: string,
    t: Transaction
) => {
    const localImagePath = await downloadImage(imageUrl);
    if (publish) {
        return fluxRepository.createPublication({
            userId,
            content: prompt || "Magic photo (Flux)",
            imageUrl: localImagePath,
            category: "flux",
        }, t);
    } else {
        return fluxRepository.createGalleryItem({
            userId,
            prompt: prompt || "Magic photo (Flux)",
            imageUrl: localImagePath,
            generationType: "image-flux",
        }, t);
    }
};