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
        });
        // NOTE: The exact path to the image URL in the response is an assumption.
        // You may need to adjust `response.data.choices[0].message.content` based on the actual API response structure.
        return response.data;
    } catch (error) {
        console.error('Error generating GPT image:', error.response?.data || error.message);
        throw new Error('Failed to generate image with GPT-4o.');
    }
};

export const downloadImage = async (imageUrl: string, destinationDir: 'gpt' | 'fal'): Promise<string> => {
    const imageDir = path.join(__dirname, `../../public/images/${destinationDir}`);
    if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
    }
    const filename = `${uuidv4()}.png`; // Assuming PNG format
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
            writer.on('finish', () => resolve(`/ai/${destinationDir}/${filename}`));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Error downloading image to ${destinationDir}:`, error);
        throw new Error('Failed to download generated image.');
    }
};

