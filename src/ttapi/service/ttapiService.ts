import fs from "fs";
import path from "path";
import axios from "axios";
import logger from "../../../shared/utils/logger";
import { v4 as uuidv4 } from "uuid";
import { Transaction } from "sequelize";
import * as ttapiRepository from "../repository/ttapiRepository";

const TTAPI_KEY = process.env.TTAPI_KEY;
const TTAPI_URL = "https://api.ttapi.org";
const BACKEND_URL = process.env.BACKEND_URL;

// --- Model Management ---

export const createTtModel = async (userId: string, name: string, description: string, files: Express.Multer.File[]) => {
    if (files.length !== 4) {
        throw new Error("Exactly 4 images are required to create a model.");
    }

    const imagePaths = files.map(f => `/ai/ttapi/${f.filename}`);

    return await ttapiRepository.createModel({
        userId,
        name,
        description,
        imagePaths
    });
};

export const getUserModels = async (userId: string) => {
    return await ttapiRepository.findModelsByUserId(userId);
};

export const deleteTtModel = async (userId: string, modelId: string) => {
    const model = await ttapiRepository.findModelById(modelId);
    if (!model) throw new Error("Model not found");
    if (model.userId !== userId) throw new Error("Access denied");

    // Удаляем файлы с диска
    model.imagePaths.forEach(relativePath => {
        const fullPath = path.join(__dirname, "../../../public", relativePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    });

    await ttapiRepository.deleteModel(model);
    return { message: "Model deleted successfully" };
};

// --- Generation ---

export const generateImage = async (userId: string, prompt: string, modelId: string) => {
    const model = await ttapiRepository.findModelById(modelId);
    if (!model) throw new Error("Model not found");

    // Формируем полные URL для API
    const inputImages = model.imagePaths.map(p => `${BACKEND_URL}${p}`);

    const payload = [
        {
            "ttapi": {
                "prompt": prompt,
                "input_image": inputImages[0],
                "input_image_2": inputImages[1],
                "input_image_3": inputImages[2],
                "input_image_4": inputImages[3]
            }
        }
    ];

    try {
        const response = await axios.post(`${TTAPI_URL}/bfl/v1/flux-2-pro`, payload, {
            headers: {
                "TT-API-KEY": TTAPI_KEY,
                "Content-Type": "application/json"
            }
        });

        // TTAPI возвращает структуру: { code: 200, msg: "success", data: { jobId: "..." } }
        return response.data;
    } catch (error: any) {
        logger.error(`TTAPI Generation Error: ${error.response?.data || error.message}`);
        throw new Error("Failed to start generation with TTAPI");
    }
};

export const getStatus = async (jobId: string) => {
    try {
        const response = await axios.post(`${TTAPI_URL}/flux/fetch`, { jobId }, {
            headers: {
                "TT-API-KEY": TTAPI_KEY
            }
        });
        return response.data;
    } catch (error: any) {
        logger.error(`TTAPI Status Error: ${error.message}`);
        return null;
    }
};

// --- Result Processing ---

const downloadImage = async (imageUrl: string): Promise<string> => {
    const imageDir = path.join(__dirname, "../../../public/images/ttapi");
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
            content: prompt || "Flux 2 Pro Generation",
            imageUrl: localImagePath,
            category: "flux-2-pro",
        }, t);
    } else {
        return ttapiRepository.createGalleryItem({
            userId,
            prompt: prompt || "Flux 2 Pro Generation",
            imageUrl: localImagePath,
            generationType: "image-flux-2",
        }, t);
    }
};