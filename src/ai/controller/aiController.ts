import { Request, Response } from 'express';
import * as aiService from '../service/aiService';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { GenerationJob } from '../../publication/models/GenerationJob';
import { checkUserBalance } from '../../transaction/service/transactionService';
import { Setting } from '../../admin/models/Setting';

export const createModel = async (req: Request, res: Response) => {
  const { name, description, instruction, provider = 'unifically' } = req.body;
  const files = req.files as Express.Multer.File[];
  const userId = req.user.id;

  if (!files || files.length === 0) {
    return apiResponse.badRequest(res, 'At least 1 image is required.');
  }
  if (!name) {
    return apiResponse.badRequest(res, 'Model name is required.');
  }

  const model = await aiService.createModel(
    userId,
    name,
    description,
    instruction,
    files,
    provider
  );
  apiResponse.success(res, model, 'Model created successfully.', 201);
};

export const updateModel = async (req: Request, res: Response) => {
  const { modelId } = req.params;
  const { name, description, instruction, imagesToDelete } = req.body;
  const files = req.files as Express.Multer.File[];

  const model = await aiService.updateModel(
    req.user.id,
    modelId as string,
    { name, description, instruction, imagesToDelete },
    files
  );
  apiResponse.success(res, model, 'Model updated successfully.');
};

export const deleteModel = async (req: Request, res: Response) => {
  const { modelId } = req.params;
  await aiService.deleteModel(req.user.id, modelId as string);
  apiResponse.success(res, null, 'Model deleted.');
};

export const getModels = async (req: Request, res: Response) => {
  const models = await aiService.getUserModels(req.user.id);
  apiResponse.success(res, models);
};

export const getModel = async (req: Request, res: Response) => {
  const { modelId } = req.params;
  const model = await aiService.getModelById(req.user.id, modelId as string);
  if (!model) return apiResponse.notFound(res, 'Model not found');
  apiResponse.success(res, model);
};

export const generateImage = async (req: Request, res: Response) => {
  const {
    prompt,
    modelId,
    publish,
    aspect_ratio,
    width,
    height,
    seed,
    quality,
    safety_tolerance,
  } = req.body;
  const userId = req.user.id;

  try {
    // Получаем цены из БД
    const settings = await Setting.findByPk(1);
    const cost =
      quality === '2K' ? settings?.aiCost2K || 20 : settings?.aiCost1K || 15;

    const hasBalance = await checkUserBalance(userId, cost);
    if (!hasBalance)
      return apiResponse.badRequest(res, `Нужно ${cost} кредитов.`);

    const result = await aiService.generateImage(userId, modelId, prompt, {
      quality,
      aspect_ratio: aspect_ratio || '9:16',
    });

    const job = await GenerationJob.create({
      userId,
      service: 'ai',
      serviceTaskId: result.taskId,
      status: 'pending',
      meta: {
        prompt,
        modelId,
        provider: result.provider,
        quality,
        aspect_ratio: aspect_ratio || '9:16',
        publish,
      },
    });

    apiResponse.success(res, { jobId: job.id });
  } catch (error: any) {
    apiResponse.internalError(res, error.message);
  }
};

export const retryJob = async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const oldJob = await GenerationJob.findByPk(jobId as string);

  if (!oldJob || oldJob.userId !== req.user.id) {
    return apiResponse.notFound(res, 'Job not found');
  }

  try {
    const result = await aiService.generateImage(
      oldJob.userId,
      oldJob.meta.modelId,
      oldJob.meta.prompt,
      {
        quality: oldJob.meta.quality || '1K',
        aspect_ratio: oldJob.meta.aspect_ratio || '9:16',
      }
    );

    // Сбрасываем старый джоб в исходное состояние
    oldJob.serviceTaskId = result.taskId;
    oldJob.status = 'pending';
    oldJob.errorMessage = '';
    oldJob.createdAt = new Date(); // Сбрасываем отсчет для таймаута
    oldJob.meta = { ...oldJob.meta, provider: result.provider, retryCount: 0 };
    await oldJob.save();

    apiResponse.success(res, { jobId: oldJob.id }, 'Job restarted successfully');
  } catch (error: any) {
    apiResponse.internalError(res, error.message);
  }
};