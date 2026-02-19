import http from 'http';
import axios from 'axios';
import dotenv from 'dotenv';
import logger from '../../../shared/utils/logger';

import { v4 as uuidv4 } from 'uuid';
import { Transaction } from 'sequelize';
import { s3Storage } from '../../../shared/config/s3Storage';
import * as klingRepository from '../repository/klingRepository';

dotenv.config();

const KLING_API_URL = 'https://api.unifically.com/kling/v1/videos';
const KLING_API_KEY = process.env.KLING_API;
const httpAgent = new http.Agent({ keepAlive: true });

interface KlingGenerationPayload {
  model: string;
  image_url: string;
  prompt: string;
  duration: number;
  aspect_ratio: string;
  negative_prompt?: string;
  effect?: string;
}

export const generateKlingVideo = async (payload: KlingGenerationPayload) => {
  try {
    const response = await axios.post(`${KLING_API_URL}/generations`, payload, {
      headers: {
        Authorization: `Bearer ${KLING_API_KEY}`,
        'Content-Type': 'application/json',
      },
      httpAgent,
    });

    console.log(response.data);

    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    logger.error(`Error generating Kling video: ${errorMessage}`);
    throw new Error('Failed to start Kling video generation.');
  }
};

export const getKlingVideoStatus = async (taskId: string) => {
  try {
    const response = await axios.get(`${KLING_API_URL}/generations/${taskId}`, {
      headers: { Authorization: `Bearer ${KLING_API_KEY}` },
      httpAgent,
      validateStatus: () => true,
    });
    return response.data;
  } catch (error: any) {
    logger.error(
      `Error getting Kling video status for task ${taskId}: ${error.response?.data || error.message}`
    );
    if (error.response && error.response.data) {
      return error.response.data;
    }
    throw new Error('Failed to get Kling video generation status.');
  }
};

export const processFinalVideo = async (
  publish: boolean,
  userId: string,
  videoUrl: string,
  prompt: string,
  t: Transaction
) => {
  const filename = `${uuidv4()}.mp4`;

  const localPath = await s3Storage.downloadAndUpload(
    videoUrl,
    'videos/kling',
    filename
  );

  if (publish) {
    return klingRepository.createPublication(
      {
        userId,
        content: prompt || 'Generated Video',
        videoUrl: localPath,
        category: 'kling',
      },
      t
    );
  } else {
    return klingRepository.createGalleryItem(
      {
        userId,
        prompt: prompt || 'Generated Video',
        imageUrl: localPath,
        generationType: 'video-kling',
      },
      t
    );
  }
};
