import fs from "fs";
import path from "path";
import axios from "axios";
import logger from "../../../shared/utils/logger";
import { v4 as uuidv4 } from "uuid";
import { Transaction } from "sequelize";
import { fromPublic, publicDir } from "../../../shared/utils/paths";
import * as ttapiRepository from "../repository/ttapiRepository";

const TTAPI_KEY = process.env.TTAPI_KEY;
const TTAPI_URL = "https://api.ttapi.org";
const BACKEND_URL = process.env.BACKEND_URL;

export interface TtGenerateOptions {
    width?: number;
    height?: number;
    seed?: number;
    safety_tolerance?: number;
    output_format?: string;
}

export const createTtModel = async (
    userId: string,
    name: string,
    description: string,
    instruction: string,
    files: Express.Multer.File[]
) => {
    if (files.length === 0) {
        throw new Error("At least one image is required.");
    }

    const imagePaths = files.map(f => `/ai/ttapi/${f.filename}`);
    return await ttapiRepository.createModel({
        userId,
        name,
        description,
        instruction,
        imagePaths
    });
};

export const updateTtModel = async (
    userId: string,
    modelId: string,
    data: { name?: string, description?: string, instruction?: string },
    files?: Express.Multer.File[]
) => {
    const model = await ttapiRepository.findModelById(modelId);
    if (!model || model.userId !== userId) throw new Error("Access denied or model not found");

    if (files && files.length > 0) {
        model.imagePaths.forEach(p => {
            const fullPath = fromPublic(p);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
        });
        model.imagePaths = files.map(f => `/ai/ttapi/${f.filename}`);
    }

    if (data.name) model.name = data.name;
    if (data.description !== undefined) model.description = data.description;
    if (data.instruction !== undefined) model.instruction = data.instruction;

    return await model.save();
};

export const getUserModels = async (userId: string) => {
    return await ttapiRepository.findModelsByUserId(userId);
};

export const deleteTtModel = async (userId: string, modelId: string) => {
    const model = await ttapiRepository.findModelById(modelId);
    if (!model) throw new Error("Model not found");
    if (model.userId !== userId) throw new Error("Access denied");

    model.imagePaths.forEach(relativePath => {
        const fullPath = fromPublic(relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    });
    await ttapiRepository.deleteModel(model);
    return { message: "Model deleted successfully" };
};

export const getTtModelById = async (userId: string, modelId: string) => {
    const model = await ttapiRepository.findModelById(modelId);
    if (model && model.userId === userId) {
        return model;
    }
    return null;
};

// --- Generation ---

export const generateImage = async (
    userId: string,
    prompt: string,
    modelId: string,
    options: TtGenerateOptions = {}
) => {
    const model = await ttapiRepository.findModelById(modelId);
    if (!model) throw new Error("Model not found");

    const inputImages = model.imagePaths.map(p => `${BACKEND_URL}${p}`);

    // Добавление инструкции
    const finalPrompt = model.instruction
        ? `${model.instruction}. ${prompt}`
        : prompt;

    // TTAPI принимает input_image, input_image_2 ... до 8
    const requestBody: any = {
        prompt: finalPrompt,
        seed: options.seed ? Number(options.seed) : undefined,
        width: options.width ? Number(options.width) : undefined,
        height: options.height ? Number(options.height) : undefined,
        safety_tolerance: options.safety_tolerance ? Number(options.safety_tolerance) : 2,
        output_format: options.output_format || "png"
    };

    // Заполняем input_image_N
    if (inputImages[0]) requestBody.input_image = inputImages[0];
    for (let i = 1; i < inputImages.length && i < 8; i++) {
        requestBody[`input_image_${i + 1}`] = inputImages[i];
    }

    // Удаляем undefined ключи
    Object.keys(requestBody).forEach(key => requestBody[key] === undefined && delete requestBody[key]);

    try {
        const response = await axios.post(`${TTAPI_URL}/bfl/v1/flux-2-pro`, requestBody, {
            headers: {
                "TT-API-KEY": String(TTAPI_KEY),
                "Content-Type": "application/json"
            }
        });
        return response.data;
    } catch (error: any) {
        logger.error(`TTAPI Generation Error: ${error.response?.data?.message || error.message}`);
        throw new Error("Failed to start generation with TTAPI");
    }
};

export const getStatus = async (jobId: string) => {
    try {
        const response = await axios.post(
            `${TTAPI_URL}/flux/fetch`,
            { jobId },
            {
                headers: {
                    "TT-API-KEY": String(TTAPI_KEY),
                    "Content-Type": "application/json"
                }
            }
        );
        return response.data;
    } catch (error: any) {
        logger.error(`TTAPI Status Error: ${error.message}`);
        return null;
    }
};

const downloadImage = async (imageUrl: string): Promise<string> => {
    const imageDir = publicDir("images", "ttapi");

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
            writer.on("finish", () => resolve(`/images/ttapi/${filename}`));
            writer.on("error", reject);
        });
    } catch (error: any) {
        logger.error(`Error downloading TTAPI image: ${error.message}`);
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
        return ttapiRepository.createPublication({
            userId,
            content: prompt || "Magic photo",
            imageUrl: localImagePath,
            category: "ttapi",
        }, t);
    } else {
        return ttapiRepository.createGalleryItem({
            userId,
            prompt: prompt || "Magic photo",
            imageUrl: localImagePath,
            generationType: "image-ttapi",
        }, t);
    }
};