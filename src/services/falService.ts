import http from 'http';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const FAL_API_URL = 'https://api.fal.ai/v1/queues';
const FAL_API_KEY = process.env.FAL_API;

const httpAgent = new http.Agent({ keepAlive: true });

export const submitFalRequest = async (modelId: string, input: any) => {
    const url = `${FAL_API_URL}/${modelId.replace('/', '-')}/requests`;
    try {
        const response = await axios.post(url, input, {
            headers: {
                'Authorization': `Key ${FAL_API_KEY}`,
                'Content-Type': 'application/json',
            },
            httpAgent,
        });
        return response.data;
    } catch (error) {
        console.error('Error submitting Fal AI request:', error.response?.data || error.message);
        throw new Error('Failed to submit request to Fal AI.');
    }
};

export const getFalResult = async (modelId: string, requestId: string) => {
    const url = `${FAL_API_URL}/${modelId.replace('/', '-')}/requests/${requestId}`;
    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Key ${FAL_API_KEY}`,
                'Content-Type': 'application/json',
            },
            httpAgent,
        });
        return response.data;
    } catch (error) {
        console.error(`Error getting Fal AI result for request ${requestId}:`, error.message);
        throw new Error('Failed to get result from Fal AI.');
    }
};
