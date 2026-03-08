import axios from 'axios';
import logger from '../../../shared/utils/logger';

import { v4 as uuidv4 } from 'uuid';
import { Transaction } from 'sequelize';
import { Setting } from '../../admin/models/Setting';
import { s3Storage } from '../../../shared/config/s3Storage';
import { GenerationJob } from '../../publication/models/GenerationJob';

import * as aiRepository from '../repository/aiRepository';

const UNIFICALLY_API_KEY = process.env.FLUX_API_KEY;
const UNIFICALLY_URL = 'https://api.unifically.com/v1/tasks';
const TTAPI_KEY = process.env.TTAPI_KEY;
const TTAPI_URL = 'https://api.ttapi.io';
const BFL_OFFICIAL_API_KEY = process.env.BFL_OFFICIAL_API_KEY;
const BFL_OFFICIAL_URL = 'https://api.bfl.ai/v1/flux-2-max';
const BACKEND_URL = process.env.BACKEND_URL;

export type Provider = 'unifically' | 'ttapi' | 'bfl-official';

export interface GenerateOptions {
  width?: number;
  height?: number;
  seed?: number;
  quality: '1K' | '2K';
  aspect_ratio?: string;
  safety_tolerance?: number;
}

const getSystemPrompt = async () => {
  const settings = await Setting.findByPk(1);
  return settings?.systemPrompt || '';
};

const getImageUrl = (src: string) => {
  if (!src) return '';

  const cleanPath = src.startsWith('/') ? src.slice(1) : src;

  if (process.env.USE_S3 === 'true') {
    const protocol = process.env.S3_USE_SSL === 'true' ? 'https' : 'http';
    const endpoint =
      process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'localhost';
    const port = process.env.S3_PORT || '9000';
    const bucket = process.env.S3_BUCKET_NAME;

    const portSuffix = port !== '80' && port !== '443' ? `:${port}` : '';

    return `${protocol}://${endpoint}${portSuffix}/${bucket}/${cleanPath}`;
  }

  return `${BACKEND_URL}/${cleanPath}`;
};

export const createModel = async (
  userId: string,
  name: string,
  description: string,
  instruction: string,
  files: Express.Multer.File[],
  provider: 'unifically' | 'ttapi' = 'unifically'
) => {
  if (!files || files.length === 0) {
    throw new Error('At least one image is required.');
  }

  const uploadResults = await s3Storage.uploadFiles(files, 'ai/models');
  const imagePaths = uploadResults.map((res) => res.key);

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

    await Promise.all(
      toDelete.map(async (pathToDelete) => {
        currentImages = currentImages.filter((p) => p !== pathToDelete);
        await s3Storage.deleteFile(pathToDelete);
      })
    );
  }

  if (files && files.length > 0) {
    const uploadResults = await s3Storage.uploadFiles(files, 'ai/models');
    const newImagePaths = uploadResults.map((res) => res.url);
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

  if (model.imagePaths && model.imagePaths.length > 0) {
    await s3Storage.deleteFiles(model.imagePaths);
  }

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
  provider: Provider;
  taskId: string;
}

const selectRandomImages = (
  imageUrls: string[],
  maxCount: number
): string[] => {
  const shuffled = [...imageUrls].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, maxCount);
};

const getUnificallyResolution = (quality: '1K' | '2K'): string => {
  return quality === '2K' ? '2mp' : '1mp';
};

const getBFLDimensions = (
  quality: '1K' | '2K',
  aspectRatio: string
): { width: number; height: number } => {
  return getDimensions(quality, aspectRatio);
};

const callUnifically = async (
  prompt: string,
  imageUrls: string[],
  options: GenerateOptions,
  maxImages: number
): Promise<{ provider: 'unifically'; taskId: string }> => {
  try {
    const selectedImages = selectRandomImages(imageUrls, maxImages);
    const sysPrompt = await getSystemPrompt();
    const finalPrompt = sysPrompt ? `${sysPrompt}\n${prompt}` : prompt;

    const resolution = getUnificallyResolution(options.quality);

    const payload = {
      model: 'black-forest-labs/flux.2-max',
      input: {
        prompt: finalPrompt,
        image_urls: selectedImages,
        aspect_ratio: options.aspect_ratio || '9:16',
        resolution,
      },
    };

    logger.info(
      `[Unifically] Request (${selectedImages.length}/${imageUrls.length} images, resolution: ${resolution}): ${JSON.stringify(payload)}`
    );

    const response = await axios.post(UNIFICALLY_URL, payload, {
      headers: {
        Authorization: `Bearer ${UNIFICALLY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const taskId = response.data?.data?.task_id;
    if (!taskId) throw new Error('No task ID from Unifically');

    logger.info(`[Unifically] Success with task_id: ${taskId}`);
    return { provider: 'unifically', taskId };
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message || error.response?.data || error.message;
    logger.error(`[Unifically] Failed: ${JSON.stringify(errorMsg)}`);
    throw error;
  }
};

const callTTAPI = async (
  prompt: string,
  imageUrls: string[],
  options: GenerateOptions
): Promise<{ provider: 'ttapi'; taskId: string }> => {
  try {
    const selectedImages = selectRandomImages(imageUrls, 4);
    const sysPrompt = await getSystemPrompt();
    const finalPrompt = sysPrompt ? `${sysPrompt}\n${prompt}` : prompt;
    const { width, height } = getSizeByQuality(
      options.quality,
      options.aspect_ratio || '9:16'
    );

    const requestBody: any = {
      prompt: finalPrompt,
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

    const taskId = response.data?.data?.jobId || response.data?.jobId;
    if (!taskId) throw new Error('No jobId from TTAPI');

    logger.info(`[TTAPI] Success with jobId: ${taskId}`);
    return { provider: 'ttapi', taskId };
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message || error.response?.data || error.message;
    logger.error(`[TTAPI] Failed: ${JSON.stringify(errorMsg)}`);
    throw error;
  }
};

const callBFLOfficial = async (
  prompt: string,
  imageUrls: string[],
  options: GenerateOptions
): Promise<{ provider: 'bfl-official'; taskId: string }> => {
  if (!BFL_OFFICIAL_API_KEY) {
    throw new Error('BFL_OFFICIAL_API_KEY is not set');
  }

  try {
    const selectedImages = selectRandomImages(imageUrls, 2);
    const { width, height } = getBFLDimensions(
      options.quality,
      options.aspect_ratio || '9:16'
    );

    const payload: any = {
      prompt,
      width,
      height,
    };

    if (selectedImages.length > 0) {
      payload.image_prompt = selectedImages[0];
    }
    if (selectedImages.length > 1) {
      payload.image_prompt2 = selectedImages[1];
    }

    logger.info(
      `[BFL-Official] Request (${selectedImages.length}/${imageUrls.length} images, ${width}x${height}, quality: ${options.quality}). REASON: primary providers failed. This provider is more expensive — $0.049/mp.`
    );
    logger.info(`[BFL-Official] Payload: ${JSON.stringify(payload)}`);

    const response = await axios.post(BFL_OFFICIAL_URL, payload, {
      headers: {
        'x-key': BFL_OFFICIAL_API_KEY,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      timeout: 30000,
    });

    const taskId = response.data?.id;
    const pollingUrl = response.data?.polling_url;

    if (!taskId) throw new Error('No task ID from BFL Official');

    logger.info(
      `[BFL-Official] Task submitted successfully. task_id: ${taskId}, polling_url: ${pollingUrl}`
    );

    return { provider: 'bfl-official', taskId };
  } catch (error: any) {
    const errorMsg =
      error.response?.data?.message || error.response?.data || error.message;
    logger.error(`[BFL-Official] Failed: ${JSON.stringify(errorMsg)}`);
    throw error;
  }
};

export const generateImage = async (
  userId: string,
  modelId: string,
  prompt: string,
  options: any,
  forceProvider?: Provider
): Promise<{ provider: Provider; taskId: string }> => {
  const model = await aiRepository.findModelById(modelId);
  if (!model) throw new Error('Model not found');

  const imageUrls = model.imagePaths.map((p) => getImageUrl(p));
  const sysPrompt = model.isSystemPromptEnabled ? await getSystemPrompt() : '';
  const finalPrompt = `${sysPrompt}${model.instruction || ''}${prompt}`.trim();
  const aspectRatio = options.aspect_ratio || '9:16';
  const { width, height } = getDimensions(options.quality, aspectRatio);

  if (forceProvider === 'ttapi') {
    return await callTTAPI(finalPrompt, imageUrls, {
      ...options,
      width,
      height,
      aspect_ratio: aspectRatio,
    });
  } else if (forceProvider === 'unifically') {
    return await callUnifically(
      finalPrompt,
      imageUrls,
      { ...options, aspect_ratio: aspectRatio },
      4
    );
  } else if (forceProvider === 'bfl-official') {
    logger.warn(
      `[AI Service] Force-routing to BFL-Official for user ${userId}. This provider is more expensive.`
    );
    return await callBFLOfficial(finalPrompt, imageUrls, {
      ...options,
      aspect_ratio: aspectRatio,
    });
  }

  try {
    logger.info(`[AI Service] Trying Unifically for user ${userId}`);
    return await callUnifically(
      finalPrompt,
      imageUrls,
      { ...options, aspect_ratio: aspectRatio },
      8
    );
  } catch (error) {
    logger.warn(
      `[AI Service] Unifically failed immediately, falling back to TTAPI`
    );
    return await callTTAPI(finalPrompt, imageUrls, {
      ...options,
      width,
      height,
      aspect_ratio: aspectRatio,
    });
  }
};

export const checkStatus = async (taskId: string, provider: Provider) => {
  if (provider === 'unifically') {
    try {
      const response = await axios.get(`${UNIFICALLY_URL}/${taskId}`, {
        headers: { Authorization: `Bearer ${UNIFICALLY_API_KEY}` },
      });
      return response.data?.data || response.data;
    } catch (error: any) {
      const status = error.response?.status;
      logger.error(
        `[Unifically] Status check failed: ${error.message} (HTTP ${status})`
      );

      if (status === 400 || status === 404) {
        return {
          status: 'failed',
          error: {
            message: `API Error ${status}: Task not found or bad request`,
          },
        };
      }
      return null;
    }
  } else if (provider === 'ttapi') {
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
      const status = error.response?.status;
      logger.error(
        `[TTAPI] Status check failed: ${error.message} (HTTP ${status})`
      );

      if (status === 400 || status === 404) {
        return { status: 'FAILED', message: `TTAPI Error ${status}` };
      }
      return null;
    }
  } else if (provider === 'bfl-official') {
    if (!BFL_OFFICIAL_API_KEY) {
      logger.error('[BFL-Official] BFL_OFFICIAL_API_KEY is not set');
      return {
        status: 'failed',
        error: { message: 'BFL_OFFICIAL_API_KEY not configured' },
      };
    }
    try {
      const response = await axios.get(`https://api.bfl.ai/v1/get_result`, {
        params: { id: taskId },
        headers: {
          'x-key': BFL_OFFICIAL_API_KEY,
          accept: 'application/json',
        },
      });

      const data = response.data;
      logger.info(`[BFL-Official] Status for ${taskId}: ${data?.status}`);
      return data;
    } catch (error: any) {
      const status = error.response?.status;
      logger.error(
        `[BFL-Official] Status check failed: ${error.message} (HTTP ${status})`
      );

      if (status === 400 || status === 404) {
        return {
          status: 'Error',
          error: { message: `BFL-Official API Error ${status}` },
        };
      }
      return null;
    }
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
  const filename = `${uuidv4()}.png`;
  const savedUrl = await s3Storage.downloadAndUpload(
    imageUrl,
    'images/ai',
    filename
  );

  if (jobId) {
    const job = await GenerationJob.findByPk(jobId, { transaction: t });
    if (job) {
      job.resultUrl = savedUrl;
      job.status = 'completed';
      if (publish) {
        await aiRepository.createPublication(
          {
            userId,
            content: prompt,
            imageUrl: savedUrl,
            category: 'ai',
          },
          t
        );
        job.isPublished = true;
      }
      await job.save({ transaction: t });
    }
  }

  return { imageUrl: savedUrl };
};

const getDimensions = (
  quality: '1K' | '2K' = '1K',
  aspectRatio: string = '1:1'
): { width: number; height: number } => {
  const baseSize = quality === '2K' ? 2048 : 1024;
  const [wRatio, hRatio] = aspectRatio.split(':').map(Number);

  if (!wRatio || !hRatio || wRatio === hRatio) {
    return { width: baseSize, height: baseSize };
  }

  if (wRatio > hRatio) {
    return {
      width: baseSize,
      height: Math.round((baseSize * (hRatio / wRatio)) / 8) * 8,
    };
  } else {
    return {
      width: Math.round((baseSize * (wRatio / hRatio)) / 8) * 8,
      height: baseSize,
    };
  }
};

const getSizeByQuality = (
  quality: '1K' | '2K' = '1K',
  aspectRatio: string = '1:1'
): { width: number; height: number } => {
  const baseSize = quality === '2K' ? 2048 : 1024;

  const [wRatio, hRatio] = aspectRatio.split(':').map(Number);

  if (!wRatio || !hRatio) return { width: baseSize, height: baseSize };

  if (wRatio === hRatio) return { width: baseSize, height: baseSize };

  if (wRatio > hRatio) {
    return {
      width: baseSize,
      height: Math.round(baseSize * (hRatio / wRatio)),
    };
  } else {
    return {
      width: Math.round(baseSize * (wRatio / hRatio)),
      height: baseSize,
    };
  }
};
