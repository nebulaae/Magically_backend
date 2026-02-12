import db from '../../../shared/config/database';
import logger from '../../../shared/utils/logger';
import { Request, Response } from 'express';
import { GenerationJob } from '../../publication/models/GenerationJob';
import { deductTokensForGeneration } from '../../../shared/utils/userActions';
import * as higgsfieldService from '../service/higgsfieldService';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { s3Storage } from '../../../shared/config/s3Storage';

export const generateHiggsfieldVideo = async (req: Request, res: Response) => {
  const { prompt, motion_id, model, enhance_prompt, seed, publish } = req.body;
  const files = req.files as Express.Multer.File[];
  const userId = req.user.id;
  const isPublish = publish === 'true' || publish === true;

  if (!prompt || !motion_id) {
    return apiResponse.badRequest(
      res,
      "Both 'prompt' and 'motion_id' are required."
    );
  }

  if (!files || files.length < 1) {
    return apiResponse.badRequest(res, 'At least one image is required.');
  }

  // const startImageUrl = `${process.env.BACKEND_URL}/ai/higgsfield/${files[0].filename}`;
  // const endImageUrl =
  //   files.length > 1
  //     ? `${process.env.BACKEND_URL}/ai/higgsfield/${files[1].filename}`
  //     : undefined;

  const t = await db.transaction();

  try {
    await deductTokensForGeneration(userId, 'video', t);

    // ИСПРАВЛЕНИЕ: Загружаем файлы в S3
    // Higgsfield может принимать 2 картинки (start/end)
    const uploadResults = await s3Storage.uploadFiles(files, 'ai/higgsfield');

    const getUrl = (index: number) => {
      if (!uploadResults[index]) return undefined;
      const key = uploadResults[index].key;
      if (process.env.USE_S3 === 'true') {
        return s3Storage.getPublicUrl(key);
      }
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      return `${process.env.BACKEND_URL}/${cleanKey}`;
    };

    const startImageUrl = getUrl(0);
    const endImageUrl = getUrl(1);

    const payload = {
      prompt,
      motion_id,
      model: model || 'standard',
      enhance_prompt: enhance_prompt === 'true' || false,
      seed: seed ? parseInt(seed, 10) : undefined,
      start_image_url: startImageUrl,
      end_image_url: endImageUrl,
    };

    const genResponse = await higgsfieldService.generateVideo(payload);

    const taskId =
      genResponse?.data?.task_id ||
      genResponse?.task_id ||
      genResponse?.data_id;

    if (!taskId) {
      throw new Error('Failed to retrieve task_id from Higgsfield response.');
    }

    const job = await GenerationJob.create(
      {
        userId,
        service: 'higgsfield',
        serviceTaskId: taskId,
        status: 'pending',
        meta: {
          prompt: prompt || 'Higgsfield Video',
          publish: isPublish,
          motion_id: motion_id,
        },
      },
      { transaction: t }
    );

    await t.commit();

    apiResponse.success(
      res,
      { jobId: job.id, status: 'pending' },
      'Higgsfield generation started'
    );
  } catch (error) {
    await t.rollback();
    logger.error(`Higgsfield Start Error: ${error.message}`);
    apiResponse.internalError(res, error.message);
  }
};

export const getHiggsfieldMotions = async (req: Request, res: Response) => {
  try {
    const { size, cursor } = req.query;
    const result = await higgsfieldService.getMotions(
      size ? parseInt(size as string, 10) : 30,
      cursor ? parseInt(cursor as string, 10) : undefined
    );
    apiResponse.success(res, result, 'Fetched Higgsfield motion presets.');
  } catch (error: any) {
    logger.error(`Error fetching Higgsfield motions: ${error.message}`);
    apiResponse.internalError(res, error.message);
  }
};
