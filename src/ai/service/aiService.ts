import fs from "fs";
import path from "path";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { Transaction } from "sequelize";
import logger from "../../../shared/utils/logger";
import { TrainingModel } from "../models/TrainingModel";
import { fromPublic, publicDir } from "../../../shared/utils/paths";
import * as aiRepository from "../repository/aiRepository";

const UNIFICALLY_API_KEY = process.env.FLUX_API_KEY;
const UNIFICALLY_URL = "https://api.unifically.com/flux.2-max";
const TTAPI_KEY = process.env.TTAPI_KEY;
const TTAPI_URL = "https://api.ttapi.org";
const BACKEND_URL = process.env.BACKEND_URL;
const SYSTEM_INSTRUCTIONS = "Photorealistic, studio lighting, non-destructive retouching; flawless, smooth skin without pores and other face defects; no blemishes, freckles, acne, dark spots, wrinkles, shine; subtle makeup-like finish; even complexion; preserved facial features; crisp eyes/lips; natural hair texture; cinematic color grading. Learn from the uploaded photos and create an image.";

export interface GenerateOptions {
    width?: number;
    height?: number;
    seed?: number;
    aspect_ratio?: string;
    safety_tolerance?: number;
}

// ============ CRUD для моделей ============

export const createModel = async (
    userId: string,
    name: string,
    description: string,
    instruction: string,
    files: Express.Multer.File[],
    provider: "unifically" | "ttapi" = "unifically"
) => {
    if (files.length === 0) {
        throw new Error("At least one image is required.");
    }

    const imagePaths = files.map((f) => `/ai/models/${f.filename}`);
    return await aiRepository.createModel({
        userId,
        name,
        description,
        instruction,
        imagePaths,
        provider,
    });
};

export const updateModel = async (
    userId: string,
    modelId: string,
    data: { name?: string; description?: string; instruction?: string },
    files?: Express.Multer.File[]
) => {
    const model = await aiRepository.findModelById(modelId);
    if (!model || model.userId !== userId) {
        throw new Error("Access denied or model not found");
    }

    if (files && files.length > 0) {
        model.imagePaths.forEach((p) => {
            const fullPath = fromPublic(p);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        });
        model.imagePaths = files.map((f) => `/ai/models/${f.filename}`);
    }

    if (data.name) model.name = data.name;
    if (data.description !== undefined) model.description = data.description;
    if (data.instruction !== undefined) model.instruction = data.instruction;

    return await model.save();
};

export const getUserModels = async (userId: string) => {
    return await aiRepository.findModelsByUserId(userId);
};

export const deleteModel = async (userId: string, modelId: string) => {
    const model = await aiRepository.findModelById(modelId);
    if (!model) throw new Error("Model not found");
    if (model.userId !== userId) throw new Error("Access denied");

    model.imagePaths.forEach((relativePath) => {
        const fullPath = fromPublic(relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    });

    await aiRepository.deleteModel(model);
    return { message: "Model deleted successfully" };
};

export const getModelById = async (userId: string, modelId: string) => {
    const model = await aiRepository.findModelById(modelId);
    if (model && model.userId === userId) {
        return model;
    }
    return null;
};

// ============ Генерация с fallback ============

interface GenerationResult {
    provider: "unifically" | "ttapi";
    taskId: string;
}

// Unifically API
const callUnifically = async (
    prompt: string,
    imageUrls: string[],
    options: GenerateOptions
): Promise<GenerationResult> => {
    try {
        const payload = {
            prompt: SYSTEM_INSTRUCTIONS + prompt,
            image_urls: imageUrls,
            aspect_ratio: options.aspect_ratio || "1:1",
            quality: "1K",
        };

        logger.info(`[Unifically] Request: ${JSON.stringify(payload)}`);

        const response = await axios.post(`${UNIFICALLY_URL}/generate`, payload, {
            headers: {
                Authorization: `Bearer ${UNIFICALLY_API_KEY}`,
                "Content-Type": "application/json",
            },
            timeout: 30000,
        });

        logger.info(`[Unifically] Response: ${JSON.stringify(response.data)}`);

        // Unifically возвращает { code: 200, data: { task_id: "..." } }
        const taskId = response.data?.data?.task_id || response.data?.task_id;

        if (!taskId) {
            logger.error(`[Unifically] No task_id in response: ${JSON.stringify(response.data)}`);
            throw new Error("No task ID from Unifically");
        }

        logger.info(`[Unifically] Success with task_id: ${taskId}`);
        return { provider: "unifically", taskId };
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.response?.data || error.message;
        logger.error(`[Unifically] Failed: ${JSON.stringify(errorMsg)}`);
        throw error;
    }
};

// TTAPI Fallback
const callTTAPI = async (
    prompt: string,
    imageUrls: string[],
    options: GenerateOptions
): Promise<GenerationResult> => {
    try {
        const requestBody: any = {
            prompt: SYSTEM_INSTRUCTIONS + prompt,
            width: options.width || 1024,
            height: options.height || 1024,
            seed: options.seed,
            safety_tolerance: options.safety_tolerance || 2,
            output_format: "png",
        };

        // Маппинг картинок для TTAPI
        if (imageUrls[0]) requestBody.input_image = imageUrls[0];
        for (let i = 1; i < imageUrls.length && i < 8; i++) {
            requestBody[`input_image_${i + 1}`] = imageUrls[i];
        }

        Object.keys(requestBody).forEach((key) => requestBody[key] === undefined && delete requestBody[key]);

        logger.info(`[TTAPI] Request: ${JSON.stringify(requestBody)}`);

        const response = await axios.post(`${TTAPI_URL}/bfl/v1/flux-2-max`, requestBody, {
            headers: {
                "TT-API-KEY": String(TTAPI_KEY),
                "Content-Type": "application/json",
            },
            timeout: 30000,
        });

        logger.info(`[TTAPI] Response: ${JSON.stringify(response.data)}`);

        // TTAPI возвращает { status: "SUCCESS", data: { jobId: "..." } }
        const taskId = response.data?.data?.jobId || response.data?.jobId;

        if (!taskId) {
            logger.error(`[TTAPI] No jobId in response: ${JSON.stringify(response.data)}`);
            throw new Error("No jobId from TTAPI");
        }

        logger.info(`[TTAPI] Success with jobId: ${taskId}`);
        return { provider: "ttapi", taskId };
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.response?.data || error.message;
        logger.error(`[TTAPI] Failed: ${JSON.stringify(errorMsg)}`);
        throw error;
    }
};

// Главная функция генерации с fallback
export const generateImage = async (
    userId: string,
    modelId: string,
    prompt: string,
    options: GenerateOptions
): Promise<GenerationResult> => {
    const model = await aiRepository.findModelById(modelId);
    if (!model) throw new Error("Model not found");

    const imageUrls = model.imagePaths.map((p) => `${BACKEND_URL}${p}`);
    const finalPrompt = model.instruction ? `${model.instruction}. ${prompt}` : prompt;

    const [width, height] = parseAspectRatio(options.aspect_ratio || "1:1");

    try {
        logger.info(`[AI Service] Trying Unifically for user ${userId}`);
        return await callUnifically(finalPrompt, imageUrls, options);
    } catch (unificError) {
        logger.warn(`[AI Service] Unifically failed, falling back to TTAPI`);

        try {
            return await callTTAPI(finalPrompt, imageUrls, { ...options, width, height });
        } catch (ttapiError) {
            logger.error(`[AI Service] Both providers failed for user ${userId}`);
            throw new Error("All generation providers are unavailable");
        }
    }
};

export const checkStatus = async (taskId: string, provider: "unifically" | "ttapi") => {
    if (provider === "unifically") {
        try {
            const response = await axios.get(`${UNIFICALLY_URL}/status/${taskId}`, {
                headers: { Authorization: `Bearer ${UNIFICALLY_API_KEY}` },
            });

            // Unifically возвращает { code: 200, data: { status: "completed", output: { image_url: "..." } } }
            return response.data?.data || response.data;
        } catch (error) {
            logger.error(`[Unifically] Status check failed: ${error.message}`);
            return null;
        }
    } else {
        try {
            const response = await axios.post(
                `${TTAPI_URL}/flux/fetch`,
                { jobId: taskId },
                {
                    headers: {
                        "TT-API-KEY": String(TTAPI_KEY),
                        "Content-Type": "application/json",
                    },
                }
            );

            // TTAPI возвращает { status: "SUCCESS", data: { imageUrl: "..." } }
            return response.data;
        } catch (error) {
            logger.error(`[TTAPI] Status check failed: ${error.message}`);
            return null;
        }
    }
};

export const downloadImage = async (imageUrl: string): Promise<string> => {
    const imageDir = publicDir("images", "ai");
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
            writer.on("finish", () => resolve(`/images/ai/${filename}`));
            writer.on("error", reject);
        });
    } catch (error: any) {
        logger.error(`Error downloading image: ${error.message}`);
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

    // Всегда сохраняем в галерею
    const galleryItem = await aiRepository.createGalleryItem(
        {
            userId,
            prompt: prompt || "AI Generated",
            imageUrl: localImagePath,
            generationType: "ai-image",
        },
        t
    );

    // Если publish=true, также публикуем
    if (publish) {
        await aiRepository.createPublication(
            {
                userId,
                content: prompt || "AI Generated",
                imageUrl: localImagePath,
                category: "ai",
            },
            t
        );
    }

    return galleryItem;
};

// ============ Утилиты ============

function parseAspectRatio(ar: string): [number, number] {
    const map: Record<string, [number, number]> = {
        "1:1": [1024, 1024],
        "16:9": [1024, 576],
        "9:16": [576, 1024],
        "4:3": [1024, 768],
        "3:4": [768, 1024],
    };
    return map[ar] || [1024, 1024];
}