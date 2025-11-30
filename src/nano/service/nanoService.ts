import fs from "fs";
import http from "http";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { Transaction } from "sequelize";
import { logger } from "../../../shared/utils/logger";
import * as nanoRepository from "../repository/nanoRepository";

dotenv.config();

const NANO_API_URL = "https://api.unifically.com/nano-banana/generate";
const NANO_STATUS_URL = "https://api.unifically.com/nano-banana/status";
const API_KEY = process.env.NANO_API_KEY;
const httpAgent = new http.Agent({ keepAlive: true });

interface NanoGenerationPayload {
    prompt: string;
    aspect_ratio?: string;
    image_urls?: string[];
}

export const generateNanoImage = async (payload: NanoGenerationPayload) => {
    try {
        const response = await axios.post(NANO_API_URL, payload, {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
            },
            httpAgent,
            timeout: 1200000,
        });

        return response.data;
    } catch (error) {
        logger.error(
            `Error generating Nano image: ${JSON.stringify(error.response?.data || error.message)}`,
        );
        throw new Error("Failed to generate image with Nano Banana.");
    }
};

export const getNanoImageStatus = async (taskId: string) => {
    try {
        const statusUrl = `${NANO_STATUS_URL}/${taskId}`;
        const response = await axios.get(statusUrl, {
            headers: { Authorization: `Bearer ${API_KEY}` },
            httpAgent,
            validateStatus: () => true,
        });
        return response.data;
    } catch (error: any) {
        logger.error(
            `Error getting Nano image status for task ${taskId}: ${error.response?.data || error.message}`,
        );
        if (error.response && error.response.data) return error.response.data;
        throw new Error("Failed to get Nano image generation status.");
    }
};

const downloadImage = async (imageUrl: string): Promise<string> => {
    const imageDir = path.join(__dirname, `../../../public/images/nano`);
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
            writer.on("finish", () => resolve(`/images/nano/${filename}`));
            writer.on("error", reject);
        });
    } catch (error) {
        logger.error(`Error downloading image to nano: ${error.message}`);
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
        return nanoRepository.createPublication({
            userId,
            content: prompt || "Generated Image via Nano",
            imageUrl: localImagePath,
            category: "nano",
        },t );
    } else {
        return nanoRepository.createGalleryItem({
            userId,
            prompt: prompt || "Generated Image via Nano",
            imageUrl: localImagePath,
            generationType: "image-nano",
        }, t);
    }
};