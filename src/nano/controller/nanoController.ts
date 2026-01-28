import db from '../../../shared/config/database';
import { Request, Response } from 'express';
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
      const serverImageUrl = `${process.env.BACKEND_URL}/ai/nano/${file.filename}`;
      payload.image_urls = [serverImageUrl];
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
