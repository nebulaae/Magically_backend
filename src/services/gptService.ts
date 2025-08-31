import fs from 'fs';
import http from 'http';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const GPT_API_URL = 'https://api.unifically.com/v1/chat/completions';
const API_KEY = process.env.GPT_API;

const httpAgent = new http.Agent({ keepAlive: true });

export const generateGptImage = async (prompt: string) => {
    const payload = {
        model: "gpt-4o-image-vip",
        messages: [{
            role: "user",
            content: prompt
        }]
    };

    try {
        const response = await axios.post(GPT_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            httpAgent,
            // ADDED: Timeout to prevent long waits on unresponsive API
            timeout: 1200000 //1200 seconds
        });
        return response.data;
    } catch (error) {
        // Log the actual error response if available
        if (axios.isAxiosError(error) && error.response) {
            console.error('Error generating GPT image:', error.response.data);
        } else {
            console.error('Error generating GPT image:', error.message);
        }
        throw new Error('Failed to generate image with GPT-4o.');
    }
};

export const downloadImage = async (imageUrl: string, destinationDir: 'gpt' | 'fal'): Promise<string> => {
    const imageDir = path.join(__dirname, `../../public/images/${destinationDir}`);
    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
    }
    const filename = `${uuidv4()}.png`;
    const outputPath = path.join(imageDir, filename);

    try {
        const response = await axios({
            method: 'GET',
            url: imageUrl,
            responseType: 'stream',
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(`/images/${destinationDir}/${filename}`));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Error downloading image to ${destinationDir}:`, error);
        throw new Error('Failed to download generated image.');
    }
};

/**
 * Extracts the first full HTTPS URL from a string, which might contain markdown.
 * @param text The text content from the API response.
 * @returns The extracted URL or null if not found.
 */
export const extractImageUrl = (text: string): string | null => {
    if (!text) return null;
    const regex = /https:\/\/[^\s)]+/;
    const match = text.match(regex);
    return match ? match[0] : null;
};