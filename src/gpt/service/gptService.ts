import axios from 'axios';
import dotenv from 'dotenv';

import { v4 as uuidv4 } from 'uuid';
import { Transaction } from 'sequelize';
import { s3Storage } from '../../../shared/config/s3Storage';
import * as gptRepository from '../repository/gptRepository';

dotenv.config();

const API_KEY = process.env.GPT_API;

export const generateGptImage = async (
  data: any,
  isVersion1_5: boolean = false
) => {
  const endpoint = isVersion1_5 ? 'gpt-image-1.5' : 'gpt-image-1';
  const url = `https://api.unifically.com/${endpoint}/generate`;

  return axios.post(url, data, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
};

export const getGptImageStatus = async (
  taskId: string,
  isVersion1_5: boolean = false
) => {
  const endpoint = isVersion1_5 ? 'gpt-image-1.5' : 'gpt-image-1';
  const url = `https://api.unifically.com/${endpoint}/status/${taskId}`;

  return axios.get(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
    },
  });
};

export const extractImageUrl = (text: string): string | null => {
  if (!text) return null;
  const regex = /https:\/\/[^\s)]+/;
  const match = text.match(regex);
  return match ? match[0] : null;
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
    'images/gpt',
    filename
  );

  if (publish) {
    return gptRepository.createPublication(
      {
        userId,
        content: prompt || 'Generated Image via GPT-4o',
        imageUrl: localImagePath,
        category: 'gpt',
      },
      t
    );
  } else {
    return gptRepository.createGalleryItem(
      {
        userId,
        prompt: prompt || 'Generated Image via GPT-4o',
        imageUrl: localImagePath,
        generationType: 'image-gpt',
      },
      t
    );
  }
};
