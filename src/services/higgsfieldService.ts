import fs from 'fs';
import path from 'path';
import http from 'http';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const HIGGSFIELD_API_URL = 'https://api.unifically.com/higgsfield';
const HIGGSFIELD_API_KEY = process.env.HIGGSFIELD_API;

// Create an HTTP agent with keep-alive disabled.
// This is a robust way to prevent ECONNRESET errors on subsequent polling requests.
const httpAgent = new http.Agent({ keepAlive: false });

export const generateVideo = async (apiPayload: any, imageUrls: string[]) => {
    const requestBody = {
        ...apiPayload,
        image: imageUrls,
    };

    try {
        const response = await axios.post(`${HIGGSFIELD_API_URL}/generate`, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HIGGSFIELD_API_KEY}`,
            },
            httpAgent,
        });

        return response.data;
    } catch (error) {
        console.error('Error generating video:', error.response?.data || error.message);
        throw new Error('Failed to start video generation.');
    }
};

export const getVideo = async (taskId: string) => {
    try {
        const response = await axios.get(`${HIGGSFIELD_API_URL}/feed/${taskId}`, {
            headers: {
                'Authorization': `Bearer ${HIGGSFIELD_API_KEY}`,
            },
            httpAgent,
        });

        return response.data;
    } catch (error) {
        console.error(`Error getting Higgsfield video status for task ${taskId}:`, error.message);
        throw new Error('Failed to get video generation status.');
    }
};

export const downloadVideo = async (videoUrl: string): Promise<string> => {
    const videoDir = path.join(__dirname, '../../public/videos/higgsfield');

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
        console.error('Error downloading video:', error);
        throw new Error('Failed to download video.');
    }
};