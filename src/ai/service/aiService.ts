import fs from 'fs';
import path from 'path';
import axios from 'axios';
import logger from '../../../shared/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from 'sequelize';
import { fromPublic, publicDir } from '../../../shared/utils/paths';
import { GenerationJob } from '../../publication/models/GenerationJob';
import * as aiRepository from '../repository/aiRepository';

const UNIFICALLY_API_KEY = process.env.FLUX_API_KEY;
const UNIFICALLY_URL = 'https://api.unifically.com/v1/tasks';
const TTAPI_KEY = process.env.TTAPI_KEY;
const TTAPI_URL = 'https://api.ttapi.io';
const BACKEND_URL = process.env.BACKEND_URL;
const SYSTEM_INSTRUCTIONS = process.env.SYSTEM_PROMPT;

export interface GenerateOptions {
  width?: number;
  height?: number;
  seed?: number;
  quality: "1K" | "2K";
  aspect_ratio?: string;
  safety_tolerance?: number;
}

export const createModel = async (
  userId: string,
  name: string,
  description: string,
  instruction: string,
  files: Express.Multer.File[],
  provider: 'unifically' | 'ttapi' = 'unifically'
) => {
  if (files.length === 0) {
    throw new Error('At least one image is required.');
  }

  const imagePaths = files.map((f) => `/ai/models/${f.filename}`);
  return await aiRepository.createModel({
    userId,
    name,
    description,
    instruction,
    imagePaths,
    provider,
  });
};

export const updateModel = async (
  userId: string,
  modelId: string,
  data: {
    name?: string;
    description?: string;
    instruction?: string;
    imagesToDelete?: string[] | string;
  },
  files?: Express.Multer.File[]
) => {
  const model = await aiRepository.findModelById(modelId);
  if (!model || model.userId !== userId) {
    throw new Error('Access denied or model not found');
  }

  let currentImages = [...model.imagePaths];

  if (data.imagesToDelete) {
    let toDelete: string[] = [];

    if (typeof data.imagesToDelete === 'string') {
      try {
        toDelete = JSON.parse(data.imagesToDelete);
      } catch (e) {
        toDelete = [data.imagesToDelete];
      }
    } else if (Array.isArray(data.imagesToDelete)) {
      toDelete = data.imagesToDelete;
    }

    toDelete.forEach((pathToDelete) => {
      currentImages = currentImages.filter(p => p !== pathToDelete);
      const fullPath = fromPublic(pathToDelete);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
  }

  if (files && files.length > 0) {
    const newImagePaths = files.map((f) => `/ai/models/${f.filename}`);
    currentImages = [...currentImages, ...newImagePaths];
  }

  model.imagePaths = currentImages;

  if (data.name) model.name = data.name;
  if (data.description !== undefined) model.description = data.description;
  if (data.instruction !== undefined) model.instruction = data.instruction;

  return await model.save();
};

export const getUserModels = async (userId: string) => {
  return await aiRepository.findModelsByUserId(userId);
};

export const deleteModel = async (userId: string, modelId: string) => {
  const model = await aiRepository.findModelById(modelId);
  if (!model) throw new Error('Model not found');
  if (model.userId !== userId) throw new Error('Access denied');

  model.imagePaths.forEach((relativePath) => {
    const fullPath = fromPublic(relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  });

  await aiRepository.deleteModel(model);
  return { message: 'Model deleted successfully' };
};

export const getModelById = async (userId: string, modelId: string) => {
  const model = await aiRepository.findModelById(modelId);
  if (model && model.userId === userId) {
    return model;
  }
  return null;
};

interface GenerationResult {
  provider: 'unifically' | 'ttapi';
  taskId: string;
}

const selectRandomImages = (
  imageUrls: string[],
  maxCount: number = 4
): string[] => {
  if (imageUrls.length <= maxCount) {
    return imageUrls;
  }
  const shuffled = [...imageUrls];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, maxCount);
};

const callUnifically = async (
  prompt: string,
  imageUrls: string[],
  options: GenerateOptions
): Promise<{ provider: 'unifically', taskId: string }> => {
  try {
    const selectedImages = selectRandomImages(imageUrls, 4);

    const payload = {
      model: "black-forest-labs/flux.2-max",
      input: {
        prompt: SYSTEM_INSTRUCTIONS + prompt,
        image_urls: selectedImages,
        aspect_ratio: options.aspect_ratio || '1:1',
        resolution: options.quality === '2K' ? '2k' : '1k'
      }
    };

    logger.info(
      `[Unifically] Request (${selectedImages.length}/${imageUrls.length} images): ${JSON.stringify(payload)}`
    );

    const response = await axios.post(UNIFICALLY_URL, payload, {
      headers: {
        Authorization: `Bearer ${UNIFICALLY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.info(`[Unifically] Response: ${JSON.stringify(response.data)}`);

    const taskId = response.data?.data?.task_id;

    if (!taskId) {
      logger.error(
        `[Unifically] No task_id in response: ${JSON.stringify(response.data)}`
      );
      throw new Error('No task ID from Unifically');
    }

    logger.info(`[Unifically] Success with task_id: ${taskId}`);
    return { provider: 'unifically', taskId };
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.response?.data || error.message;
    logger.error(`[Unifically] Failed: ${JSON.stringify(errorMsg)}`);
    throw error;
  }
};

const callTTAPI = async (
  prompt: string,
  imageUrls: string[],
  options: GenerateOptions
): Promise<{ provider: 'ttapi', taskId: string }> => {
  try {
    const selectedImages = selectRandomImages(imageUrls, 4);

    const { width, height } = getSizeByQuality(options.quality, options.aspect_ratio);

    const requestBody: any = {
      prompt: SYSTEM_INSTRUCTIONS + prompt,
      width: options.width || width,
      height: options.height || height,
      seed: options.seed,
      safety_tolerance: options.safety_tolerance || 5,
      output_format: 'png',
    };

    if (selectedImages[0]) requestBody.input_image = selectedImages[0];
    for (let i = 1; i < selectedImages.length && i < 4; i++) {
      requestBody[`input_image_${i + 1}`] = selectedImages[i];
    }

    Object.keys(requestBody).forEach(
      (key) => requestBody[key] === undefined && delete requestBody[key]
    );

    logger.info(
      `[TTAPI] Request (${selectedImages.length}/${imageUrls.length} images): ${JSON.stringify(requestBody)}`
    );

    const response = await axios.post(
      `${TTAPI_URL}/bfl/v1/flux-2-max`,
      requestBody,
      {
        headers: {
          'TT-API-KEY': String(TTAPI_KEY),
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    logger.info(`[TTAPI] Response: ${JSON.stringify(response.data)}`);

    const taskId = response.data?.data?.jobId || response.data?.jobId;

    if (!taskId) {
      logger.error(
        `[TTAPI] No jobId in response: ${JSON.stringify(response.data)}`
      );
      throw new Error('No jobId from TTAPI');
    }

    logger.info(`[TTAPI] Success with jobId: ${taskId}`);
    return { provider: 'ttapi', taskId };
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.response?.data || error.message;
    logger.error(`[TTAPI] Failed: ${JSON.stringify(errorMsg)}`);
    throw error;
  }
};

export const generateImage = async (
  userId: string,
  modelId: string,
  prompt: string,
  options: GenerateOptions
): Promise<GenerationResult> => {
  const model = await aiRepository.findModelById(modelId);
  if (!model) throw new Error('Model not found');

  const imageUrls = model.imagePaths.map((p) => `${BACKEND_URL}${p}`);
  const finalPrompt = model.instruction
    ? `${model.instruction}. ${prompt}`
    : prompt;

  const [width, height] = parseAspectRatio(options.aspect_ratio || '1:1');

  logger.info(
    `[AI Service] Starting generation for user ${userId} with ${imageUrls.length} images in model`
  );

  try {
    logger.info(`[AI Service] Trying Unifically for user ${userId}`);
    return await callUnifically(finalPrompt, imageUrls, options);
  } catch (unificError) {
    logger.warn(`[AI Service] Unifically failed, falling back to TTAPI`);

    try {
      return await callTTAPI(finalPrompt, imageUrls, {
        ...options,
        width,
        height,
      });
    } catch (ttapiError) {
      logger.error(`[AI Service] Both providers failed for user ${userId}`);
      throw new Error('All generation providers are unavailable');
    }
  }
};

export const checkStatus = async (
  taskId: string,
  provider: 'unifically' | 'ttapi'
) => {
  if (provider === 'unifically') {
    try {
      const response = await axios.get(`${UNIFICALLY_URL}/${taskId}`, {
        headers: { Authorization: `Bearer ${UNIFICALLY_API_KEY}` },
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      logger.error(`[Unifically] Status check failed: ${error.message}`);
      return null;
    }
  } else {
    try {
      const response = await axios.post(
        `${TTAPI_URL}/flux/fetch`,
        { jobId: taskId },
        {
          headers: {
            'TT-API-KEY': String(TTAPI_KEY),
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error: any) {
      logger.error(`[TTAPI] Status check failed: ${error.message}`);
      return null;
    }
  }
};

export const downloadImage = async (
  imageUrl: string,
  pathname: string
): Promise<string> => {
  const imageDir = publicDir('images', pathname);
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
      writer.on('finish', () => resolve(`/images/ai/${filename}`));
      writer.on('error', reject);
    });
  } catch (error: any) {
    logger.error(`Error downloading image: ${error.message}`);
    throw new Error('Failed to download generated image.');
  }
};

export const processFinalImage = async (
  publish: boolean,
  userId: string,
  imageUrl: string,
  prompt: string,
  t: Transaction,
  jobId?: string
) => {
  const localImagePath = await downloadImage(imageUrl, 'ai');

  if (jobId) {
    const job = await GenerationJob.findByPk(jobId, { transaction: t });
    if (job) {
      job.resultUrl = localImagePath;
      job.status = 'completed';
      // Если пользователь выбрал publish при генерации
      if (publish) {
        await aiRepository.createPublication({
          userId,
          content: prompt,
          imageUrl: localImagePath,
          category: 'ai'
        }, t);
        job.isPublished = true;
      }
      await job.save({ transaction: t });
    }
  }

  return { imageUrl: localImagePath };
};

const parseAspectRatio = (ar: string): [number, number] => {
  const map: Record<string, [number, number]> = {
    '1:1': [1024, 1024],
    '16:9': [1024, 576],
    '9:16': [576, 1024],
    '4:3': [1024, 768],
    '3:4': [768, 1024],
  };
  return map[ar] || [1024, 1024];
};

const getSizeByQuality = (quality: "1K" | "2K" = "1K", aspectRatio: string = "1:1"): { width: number, height: number } => {
  const baseSize = quality === "2K" ? 2048 : 1024;

  const [wRatio, hRatio] = aspectRatio.split(':').map(Number);

  if (!wRatio || !hRatio) return { width: baseSize, height: baseSize };

  if (wRatio === hRatio) return { width: baseSize, height: baseSize };

  if (wRatio > hRatio) {
    return { width: baseSize, height: Math.round(baseSize * (hRatio / wRatio)) };
  } else {
    return { width: Math.round(baseSize * (wRatio / hRatio)), height: baseSize };
  }
};