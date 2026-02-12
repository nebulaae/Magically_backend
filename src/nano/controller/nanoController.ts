import db from '../../../shared/config/database';
import { Request, Response } from 'express';
import { s3Storage } from '../../../shared/config/s3Storage';
import { GenerationJob } from '../../publication/models/GenerationJob';
import { deductTokensForGeneration } from '../../../shared/utils/userActions';
import * as nanoService from '../service/nanoService';
import * as apiResponse from '../../../shared/utils/apiResponse';

export const generateImage = async (req: Request, res: Response) => {
  const { prompt, aspect_ratio, model_type, publish } = req.body;
  const userId = req.user.id;
  const file = req.file;
  const isPublish = publish === 'true' || publish === true;
  const isPro = model_type === 'nano-pro';

  if (!prompt) return apiResponse.badRequest(res, 'Prompt is required.');

  const t = await db.transaction();
  try {
    await deductTokensForGeneration(userId, 'image', t);

    const payload: any = { prompt, aspect_ratio: aspect_ratio || '1:1' };
    if (isPro) payload.resolution = '2k';

    if (file) {
      // ИСПРАВЛЕНИЕ: Загружаем init-image в S3 (или оставляем локально)
      // uploadFile вернет объект { url, key }. 
      // Но нам нужен полный URL для API Nano, чтобы он мог скачать картинку.
      const { key } = await s3Storage.uploadFile(file, 'ai/nano');

      // Генерируем публичный URL, который увидит Nano API
      // Внимание: Если MinIO локальный, Nano API его не увидит!
      // Для продакшена (USE_S3=true) ссылка будет вести на внешний S3/MinIO.
      // Для локальной разработки с ngrok, нужно использовать BACKEND_URL + key (если s3 выключен)

      let imageUrlForApi;
      if (process.env.USE_S3 === 'true') {
        // Получаем ссылку от S3
        imageUrlForApi = s3Storage.getPublicUrl(key);
      } else {
        // Локально через ngrok
        imageUrlForApi = `${process.env.BACKEND_URL}/${key}`;
      }

      payload.image_urls = [imageUrlForApi];
    }

    const nanoResponse = await nanoService.generateNanoImage(payload, isPro);
    const taskId = nanoResponse?.data?.task_id;

    if (!taskId) throw new Error('No task ID received from Nano service');

    const job = await GenerationJob.create(
      {
        userId,
        service: isPro ? 'nano-pro' : 'nano',
        serviceTaskId: taskId,
        status: 'pending',
        meta: {
          prompt,
          aspect_ratio,
          publish: isPublish,
          model_type,
        },
      },
      { transaction: t }
    );

    await t.commit();

    apiResponse.success(
      res,
      { jobId: job.id, status: 'pending' },
      'Generation started. Please wait.'
    );
  } catch (error) {
    await t.rollback();
    apiResponse.internalError(res, error.message);
  }
};
