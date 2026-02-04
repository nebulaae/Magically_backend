import { Request, Response } from 'express';
import { GenerationJob } from '../models/GenerationJob';
import { publishJobToReel } from '../service/jobService';
import * as apiResponse from '../../../shared/utils/apiResponse';

export const getActiveGeneration = async (req: Request, res: Response) => {
  const userId = req.user.id;

  const activeJob = await GenerationJob.findOne({
    where: {
      userId,
      status: ['pending', 'processing'],
    },
    order: [['createdAt', 'DESC']],
  });

  return apiResponse.success(res, activeJob ?? null);
};

export const getGenerationHistory = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const jobs = await GenerationJob.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  apiResponse.success(res, jobs);
};

export const getGenerationById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const job = await GenerationJob.findOne({
    where: { id, userId: req.user.id },
  });
  if (!job) return apiResponse.notFound(res, 'Job not found');
  apiResponse.success(res, job);
};

export const publishJob = async (req: Request, res: Response) => {
  try {
    const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
    const userId = req.user.id;
    const result = await publishJobToReel(jobId, userId);
    return apiResponse.success(res, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publication failed';
    return apiResponse.error(res, message, 400);
  }
};