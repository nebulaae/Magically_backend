import db from '../../../shared/config/database';
import logger from '../../../shared/utils/logger';
import { Request, Response } from 'express';
import { GenerationJob } from '../../publication/models/GenerationJob';
import { deductTokensForGeneration } from '../../../shared/utils/userActions';
import * as klingService from '../service/klingService';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { s3Storage } from '../../../shared/config/s3Storage';

export const generateVideo = async (req: Request, res: Response) => {
  const {
    model,
    prompt,
    duration,
    aspect_ratio,
    negative_prompt,
    effect,
    publish,
  } = req.body;
  const file = req.file;
  const userId = req.user.id;
  const isPublish = publish === 'true' || publish === true;

  if (!file) return apiResponse.badRequest(res, 'Image is required for Kling.');

  const t = await db.transaction();

  try {
    await deductTokensForGeneration(userId, 'video', t);

    // ИСПРАВЛЕНИЕ: Загружаем и получаем ключ
    const { key } = await s3Storage.uploadFile(file, 'ai/kling');

    // Формируем URL для внешнего API
    let imageUrlForApi;
    if (process.env.USE_S3 === 'true') {
      imageUrlForApi = s3Storage.getPublicUrl(key);
    } else {
      // Убираем начальный слеш, если он есть, чтобы не было //
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      imageUrlForApi = `${process.env.BACKEND_URL}/${cleanKey}`;
    }

    const payload = {
      model: model || 'kling-v1',
      image_url: imageUrlForApi,
      prompt,
      duration: parseInt(duration, 10) || 5,
      aspect_ratio: aspect_ratio || '16:9',
      negative_prompt,
      effect,
    };

    const genResponse = await klingService.generateKlingVideo(payload);

    const taskId =
      genResponse?.data?.task_id ||
      genResponse?.task_id ||
      genResponse?.data_id;

    if (!taskId) throw new Error('Failed to get Kling Task ID from provider');

    const job = await GenerationJob.create(
      {
        userId,
        service: 'kling',
        serviceTaskId: taskId,
        status: 'pending',
        meta: {
          prompt: prompt || 'Kling Video',
          publish: isPublish,
        },
      },
      { transaction: t }
    );

    await t.commit();

    apiResponse.success(
      res,
      { jobId: job.id, status: 'pending' },
      'Kling generation started successfully'
    );
  } catch (error) {
    await t.rollback();
    logger.error(`Kling Start Error: ${error.message}`);
    apiResponse.internalError(res, error.message);
  }
};
