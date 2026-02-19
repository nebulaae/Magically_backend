import axios from 'axios';
import dotenv from 'dotenv';

import { v4 as uuidv4 } from 'uuid';
import { Transaction } from 'sequelize';
import { logger } from '../../../shared/utils/logger';
import { s3Storage } from '../../../shared/config/s3Storage';
import * as nanoRepository from '../repository/nanoRepository';

dotenv.config();

const NANO_BASE = 'https://api.unifically.com/nano-banana';
const NANO_PRO_BASE = 'https://api.unifically.com/nano-banana-pro';
const API_KEY = process.env.NANO_API_KEY;

export const generateNanoImage = async (
  payload: any,
  isPro: boolean = false
) => {
  const url = isPro ? `${NANO_PRO_BASE}/generate` : `${NANO_BASE}/generate`;
  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // Короткий таймаут, так как мы только стартуем задачу
    });
    return response.data;
  } catch (error) {
    logger.error(`Nano API Error: ${error.message}`);
    throw new Error('Failed to start Nano generation.');
  }
};

export const getNanoImageStatus = async (
  taskId: string,
  isPro: boolean = false
) => {
  const url = isPro
    ? `${NANO_PRO_BASE}/status/${taskId}`
    : `${NANO_BASE}/status/${taskId}`;
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    return response.data;
  } catch (error) {
    return null;
  }
};

export const processFinalImage = async (
  publish: boolean,
  userId: string,
  imageUrl: string,
  prompt: string,
  t: Transaction
) => {
  const filename = `${uuidv4()}.png`;

  const localImagePath = await s3Storage.downloadAndUpload(
    imageUrl,
    'images/nano',
    filename
  );

  if (publish) {
    return nanoRepository.createPublication(
      {
        userId,
        content: prompt || 'Generated Image via Nano',
        imageUrl: localImagePath,
        category: 'nano',
      },
      t
    );
  } else {
    return nanoRepository.createGalleryItem(
      {
        userId,
        prompt: prompt || 'Generated Image via Nano',
        imageUrl: localImagePath,
        generationType: 'image-nano',
      },
      t
    );
  }
};
