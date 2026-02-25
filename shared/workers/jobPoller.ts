import db from '../config/database';
import logger from '../utils/logger';

import { Server as SocketIOServer } from 'socket.io';
import { getUserSocketId } from '../utils/socketManager';
import { GenerationJob } from '../../src/publication/models/GenerationJob';
import {
  canSpendTokens,
  spendTokens,
} from '../../src/transaction/service/transactionService';
import * as settingService from '../../src/admin/service/settingService';

import * as aiService from '../../src/ai/service/aiService';

import {
  getGptImageStatus,
  processFinalImage as processGpt,
} from '../../src/gpt/service/gptService';
import {
  getNanoImageStatus,
  processFinalImage as processNano,
} from '../../src/nano/service/nanoService';
import {
  getKlingVideoStatus,
  processFinalVideo as processKling,
} from '../../src/kling/service/klingService';
import {
  getVideoStatus as getHiggsfieldStatus,
  processFinalVideo as processHiggsfield,
} from '../../src/higgsfield/service/higgsfieldService';
import { Setting } from '../../src/admin/models/Setting';

const POLLING_INTERVAL = 3000;

export const startJobPoller = (io: SocketIOServer) => {
  logger.info('Generation job poller started.');
  setInterval(() => pollJobs(io), POLLING_INTERVAL);
};

const pollJobs = async (io: SocketIOServer) => {
  const activeJobs = await GenerationJob.findAll({
    where: { status: ['pending', 'processing'] },
  });
  if (activeJobs.length === 0) return;

  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const now = Date.now();

  for (const job of activeJobs) {
    try {
      let isComplete = false;
      let isFailed = false;
      let externalResultUrl: string | undefined;
      let errorMessage: string | undefined;
      let statusData;

      const isTimeout = now - new Date(job.createdAt).getTime() > TEN_MINUTES_MS;

      if (job.service === 'ai') {
        const provider = job.meta.provider || 'unifically';
        statusData = await aiService.checkStatus(job.serviceTaskId, provider);

        // 1. Сначала проверяем УСПЕХ (самое важное)
        if (provider === 'unifically') {
          // Unifically: ищем в data.status или просто status
          const uniStatus = statusData?.status;
          const uniUrl = statusData?.output?.image_url || statusData?.url;

          if ((uniStatus === 'completed' || uniStatus === 'succeeded' || uniStatus === 'ready') && uniUrl) {
            isComplete = true;
            externalResultUrl = uniUrl;
          } else if (uniStatus === 'failed' || uniStatus === 'error') {
            errorMessage = statusData?.error?.message || statusData?.message || 'Unifically failed';
          }
        } else {
          // TTAPI: ищем SUCCESS и наличие imageUrl в data
          // Важно: проверяем и statusData.status и statusData.data.imageUrl
          if (statusData?.status === 'SUCCESS' && statusData?.data?.imageUrl) {
            isComplete = true;
            externalResultUrl = statusData.data.imageUrl;
          } else if (statusData?.status === 'FAILED') {
            errorMessage = statusData?.message || 'TTAPI failed';
          }
        }

        // 2. Если НЕ успех и НЕ явная ошибка, проверяем таймаут 10 минут
        if (!isComplete && !errorMessage && isTimeout) {
          errorMessage = 'Job timed out after 10 minutes';
        }

        // 3. Логика ПЕРЕКЛЮЧЕНИЯ (Retry/Fallback), если есть ошибка (timeout или ошибка провайдера)
        if (errorMessage && !isComplete) {
          const retryCount = job.meta.retryCount || 0;
          if (retryCount < 3) {
            const nextProvider = provider === 'unifically' ? 'ttapi' : 'unifically';
            logger.info(`[JobPoller] Attempting fallback for Job ${job.id}. From ${provider} to ${nextProvider}. Retry: ${retryCount + 1}`);

            try {
              const retry = await aiService.generateImage(
                job.userId,
                job.meta.modelId,
                job.meta.prompt,
                {
                  quality: job.meta.quality || '1K',
                  aspect_ratio: job.meta.aspect_ratio || '9:16',
                },
                nextProvider
              );

              job.serviceTaskId = retry.taskId;
              job.meta = { ...job.meta, provider: nextProvider, retryCount: retryCount + 1 };
              job.status = 'processing';
              job.errorMessage = ''; // Очищаем старую ошибку для новой попытки
              job.createdAt = new Date(); // СБРОС ТАЙМЕРА для новой попытки
              await job.save();
              continue; // Идем к следующему джобу, этот обновится на след. тике
            } catch (e: any) {
              logger.error(`[JobPoller] Fallback failed: ${e.message}`);
              // Не убиваем джоб сразу, даем поллеру попробовать еще раз на след. тике
              job.meta = { ...job.meta, retryCount: retryCount + 1 };
              await job.save();
              continue;
            }
          } else {
            isFailed = true; // Окончательный провал после 3 попыток
          }
        }
      } else if (job.service.startsWith('gpt')) {
        const res = await getGptImageStatus(
          job.serviceTaskId,
          job.service === 'gpt-1.5'
        );
        statusData = res.data;
        if (statusData?.status === 'completed') {
          isComplete = true;
          externalResultUrl =
            statusData.url ||
            statusData.output?.image_url ||
            statusData.image_url;
        }
      } else if (job.service.startsWith('nano')) {
        const isPro = job.service === 'nano-pro';
        const res = await getNanoImageStatus(job.serviceTaskId, isPro);
        statusData = res.data;
        if (statusData?.status === 'completed') {
          isComplete = true;
          externalResultUrl = statusData.output?.image_url || statusData.url;
        }
      } else if (job.service === 'kling') {
        const res = await getKlingVideoStatus(job.serviceTaskId);
        statusData = res.data;
        if (statusData?.status === 'completed') {
          isComplete = true;
          externalResultUrl =
            statusData.video_url || statusData.output?.video_url;
        }
      } else if (job.service === 'higgsfield') {
        const res = await getHiggsfieldStatus(job.serviceTaskId);
        const hJob = res.jobs?.[0] || res;
        statusData = hJob;
        if (hJob.status === 'completed') {
          isComplete = true;
          externalResultUrl = hJob.result?.url;
        } else if (hJob.status === 'failed') {
          isFailed = true;
        }
      }

      if (statusData?.status === 'failed' && !isFailed) {
        isFailed = true;
        errorMessage = statusData.error?.message || 'Unknown error';
      }

      const userSocketId = getUserSocketId(job.userId);

      if (!isComplete && !isFailed && job.status === 'pending') {
        job.status = 'processing';
        await job.save();
        if (userSocketId) {
          io.to(userSocketId).emit('jobUpdate', {
            type: 'processing',
            jobId: job.id,
          });
        }
      }

      if (isComplete && externalResultUrl) {
        const t = await db.transaction();
        try {
          const freshJob = await GenerationJob.findByPk(job.id, {
            transaction: t,
            lock: true,
          });

          if (freshJob?.status === 'completed') {
            await t.rollback();
            continue;
          }

          const { publish, prompt } = job.meta;

          // Калькуляция стоимости
          const settings = await Setting.findByPk(1);
          let cost = 15; // дефолт

          if (job.service === 'ai') {
            // Если 2K - берем aiCost2K, если нет - aiCost1K. 
            // Если в базе пусто - используем твои дефолты 20 и 15
            if (job.meta.quality === '2K') {
              cost = settings?.aiCost2K || 20;
            } else {
              cost = settings?.aiCost1K || 15;
            }
          } else if (job.service === 'kling' || job.service === 'higgsfield') {
            cost = settings?.videoCost || 40;
          } else {
            cost = settings?.imageCost || 15;
          }
          const hasBalance = await canSpendTokens(job.userId, cost);
          if (!hasBalance) {
            await t.rollback();

            job.status = 'failed';
            job.errorMessage = 'Insufficient tokens to complete generation';
            await job.save();

            if (userSocketId) {
              io.to(userSocketId).emit('jobUpdate', {
                type: 'failed',
                jobId: job.id,
                error: 'Insufficient tokens to complete generation',
              });
            }

            logger.error(
              `Job ${job.id} failed: Insufficient tokens for user ${job.userId}`
            );
            continue;
          }

          await spendTokens(
            job.userId,
            cost,
            `Generation: ${job.service.toUpperCase()}`,
            t
          );

          let resultItem;

          if (job.service === 'ai') {
            resultItem = await aiService.processFinalImage(
              publish,
              job.userId,
              externalResultUrl,
              prompt,
              t
            );
          } else if (job.service.startsWith('gpt')) {
            resultItem = await processGpt(
              publish,
              job.userId,
              externalResultUrl,
              prompt,
              t
            );
          } else if (job.service.startsWith('nano')) {
            resultItem = await processNano(
              publish,
              job.userId,
              externalResultUrl,
              prompt,
              t
            );
          } else if (job.service === 'kling') {
            resultItem = await processKling(
              publish,
              job.userId,
              externalResultUrl,
              prompt,
              t
            );
          } else if (job.service === 'higgsfield') {
            resultItem = await processHiggsfield(
              publish,
              job.userId,
              externalResultUrl,
              prompt,
              t
            );
          }

          if (!resultItem) {
            throw new Error(
              `No result item returned for service: ${job.service}`
            );
          }

          job.status = 'completed';
          job.resultUrl = resultItem.imageUrl || resultItem.videoUrl;

          await job.save({ transaction: t });
          await t.commit();

          if (userSocketId) {
            io.to(userSocketId).emit('jobUpdate', {
              type: 'completed',
              jobId: job.id,
              result: resultItem,
            });
          }

          logger.info(`Job ${job.id} completed successfully`);
        } catch (err: any) {
          await t.rollback();
          logger.error(`Error saving job ${job.id}: ${err.message}`);
        }
      } else if (isFailed) {
        job.status = 'failed';
        job.errorMessage = errorMessage;
        await job.save();

        if (userSocketId) {
          io.to(userSocketId).emit('jobUpdate', {
            type: 'failed',
            jobId: job.id,
            error: errorMessage,
          });
        }

        logger.error(`Job ${job.id} failed: ${errorMessage}`);
      }
    } catch (e: any) {
      logger.error(`Poller loop error for job ${job.id}: ${e.message}`);
    }
  }
};
