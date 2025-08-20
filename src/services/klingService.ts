import fs from 'fs';
import path from 'path';
import http from 'http';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const KLING_API_URL = 'https://api.unifically.com/kling/v1/videos';
const KLING_API_KEY = process.env.KLING_API;

// Create an HTTP agent with keep-alive disabled.
const httpAgent = new http.Agent({ keepAlive: false });

interface KlingGenerationPayload {
    model: string;
    image_url: string;
    prompt: string;
    duration: number;
    aspect_ratio: string;
    origin_task_id?: string;
    negative_prompt?: string;
    effect?: string;
}

export const generateKlingVideo = async (payload: KlingGenerationPayload) => {
    try {
        const response = await axios.post(`${KLING_API_URL}/generations`, payload, {
            headers: {
                'Authorization': `Bearer ${KLING_API_KEY}`,
                'Content-Type': 'application/json',
            },
            httpAgent,
        });
        return response.data;
    } catch (error) {
        console.error('Error generating Kling video:', error.response?.data || error.message);
        throw new Error('Failed to start Kling video generation.');
    }
};

export const getKlingVideoStatus = async (taskId: string) => {
    try {
        const response = await axios.get(`${KLING_API_URL}/generations/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${KLING_API_KEY}`,
            },
            httpAgent,
        });
        return response.data;
    } catch (error) {
        console.error(`Error getting Kling video status for task ${taskId}:`, error.message);
        throw new Error('Failed to get Kling video generation status.');
    }
};

export const downloadKlingVideo = async (videoUrl: string): Promise<string> => {
    const videoDir = path.join(__dirname, '../../public/videos/kling');

    if (!fs.existsSync(videoDir)) {
        fs.mkdirSync(videoDir, { recursive: true });
    }

    const filename = `${uuidv4()}.mp4`;
    const outputPath = path.join(videoDir, filename);

    try {
        const response = await axios({
            method: 'GET',
            url: videoUrl,
            responseType: 'stream',
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(`/videos/${filename}`));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Error downloading Kling video:', error);
        throw new Error('Failed to download Kling video.');
    }
};