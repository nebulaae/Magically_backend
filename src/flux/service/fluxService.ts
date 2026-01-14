import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { Transaction } from "sequelize";
import { logger } from "../../../shared/utils/logger";
import * as fluxRepository from "../repository/fluxRepository";

dotenv.config();

const API_KEY = process.env.FLUX_API_KEY; // Убедись, что ключ есть в .env
const BASE_URL = "https://api.unifically.com/flux.2-pro";

// Генерация через Unifically
export const generateFluxImage = async (payload: any) => {
    try {
        const response = await axios.post(`${BASE_URL}/generate`, payload, {
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
            timeout: 30000,
        });
        return response.data;
    } catch (error: any) {
        logger.error(`Flux Unifically API Error: ${error.message}`);
        throw new Error("Failed to start Flux generation.");
    }
};

// Проверка статуса
export const getFluxImageStatus = async (taskId: string) => {
    try {
        const response = await axios.get(`${BASE_URL}/status/${taskId}`, {
            headers: { "Authorization": `Bearer ${API_KEY}` }
        });
        return response.data;
    } catch (error) {
        return null;
    }
};

// Скачивание и сохранение
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
            content: prompt || "Generated Image via Flux.2 Pro",
            imageUrl: localImagePath,
            category: "flux",
        }, t);
    } else {
        return fluxRepository.createGalleryItem({
            userId,
            prompt: prompt || "Generated Image via Flux.2 Pro",
            imageUrl: localImagePath,
            generationType: "image-flux",
        }, t);
    }
};