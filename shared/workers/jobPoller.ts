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
        let aiProviderFailed = false;
        let errorMsg = '';

        if (!isTimeout) {
          statusData = await aiService.checkStatus(job.serviceTaskId, provider);

          if (provider === 'unifically') {
            if (statusData?.status === 'failed') {
              aiProviderFailed = true;
              errorMsg = statusData.error?.message || 'Unifically failed';
            } else if (statusData?.status === 'succeeded' || statusData?.status === 'ready') {
              isComplete = true;
              externalResultUrl = statusData.output?.image_url || statusData.url;
            }
          } else {
            if (statusData?.status === 'FAILED') {
              aiProviderFailed = true;
              errorMsg = statusData.message || 'TTAPI failed';
            } else if (statusData?.status === 'SUCCESS' && statusData?.data?.imageUrl) {
              isComplete = true;
              externalResultUrl = statusData.data.imageUrl;
            }
          }
        }

        // Логика переключения (Цикличный чейн: Uni -> TTAPI -> Uni -> TTAPI)
        if (aiProviderFailed || isTimeout) {
          const retryCount = job.meta.retryCount || 0;
          if (retryCount < 3) {
            const nextProvider = provider === 'unifically' ? 'ttapi' : 'unifically';
            logger.info(`[JobPoller] Job ${job.id} failed/timeout on ${provider}. Switching to ${nextProvider}. Retry ${retryCount + 1}/3`);

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
              job.createdAt = new Date(); // Сбрасываем таймер таймаута
              await job.save();
              continue; // Переходим к следующему джобу
            } catch (e: any) {
              logger.error(`[JobPoller] Retry switch failed: ${e.message}`);
              isFailed = true;
              errorMessage = e.message;
            }
          } else {
            isFailed = true;
            errorMessage = errorMsg || 'Job failed after max retries';
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

          const settings = await settingService.getSettings();
          const cost =
            job.service === 'kling' || job.service === 'higgsfield'
              ? settings.videoCost
              : settings.imageCost;

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
