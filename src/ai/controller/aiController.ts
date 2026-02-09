import { Request, Response } from 'express';
import * as aiService from '../service/aiService';
import * as apiResponse from '../../../shared/utils/apiResponse';
import { GenerationJob } from '../../publication/models/GenerationJob';
import db from '../../../shared/config/database';
import { performTransaction } from '../../transaction/service/transactionService';

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
  const isPublish = publish === 'true' || publish === true;

  if (!prompt || !modelId) {
    return apiResponse.badRequest(res, 'Prompt and Model ID are required.');
  }

  const t = await db.transaction();
  try {
    // СПИСЫВАЕМ ТОКЕНЫ СРАЗУ (ПРЕДОПЛАТА)
    const AI_COST = 15;
    await performTransaction(
      userId,
      AI_COST,
      'debit',
      'Generation: AI (Flux)',
      t
    );

    // Теперь запускаем генерацию
    const result = await aiService.generateImage(userId, modelId, prompt, {
      aspect_ratio,
      width,
      height,
      seed,
      quality,
      safety_tolerance,
    });

    const job = await GenerationJob.create({
      userId,
      service: 'ai' as any,
      serviceTaskId: result.taskId,
      status: 'pending',
      meta: {
        prompt,
        publish: isPublish,
        modelId,
        provider: result.provider,
        aspect_ratio,
        seed,
      },
    }, { transaction: t });

    await t.commit();

    apiResponse.success(
      res,
      { jobId: job.id, provider: result.provider },
      'Generation started.'
    );
  } catch (error: any) {
    await t.rollback();
    // Понятная ошибка для пользователя
    if (error.message === 'Insufficient tokens') {
      return apiResponse.badRequest(res, 'Insufficient tokens for AI generation (15 tokens required)');
    }
    apiResponse.internalError(res, error.message);
  }
};