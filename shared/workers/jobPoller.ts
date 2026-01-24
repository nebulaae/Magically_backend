import db from "../config/database";
import logger from "../utils/logger";

import { Server as SocketIOServer } from "socket.io";
import { getUserSocketId } from "../utils/socketManager";
import { GenerationJob } from "../../src/publication/models/GenerationJob";
import { performTransaction } from "../../src/transaction/service/transactionService";

import * as aiService from "../../src/ai/service/aiService";

import {
  getGptImageStatus,
  processFinalImage as processGpt
} from "../../src/gpt/service/gptService";
import {
  getNanoImageStatus,
  processFinalImage as processNano
} from "../../src/nano/service/nanoService";
import {
  getKlingVideoStatus,
  processFinalVideo as processKling
} from "../../src/kling/service/klingService";
import {
  getVideoStatus as getHiggsfieldStatus,
  processFinalVideo as processHiggsfield
} from "../../src/higgsfield/service/higgsfieldService";

const POLLING_INTERVAL = 3000;

export const startJobPoller = (io: SocketIOServer) => {
  logger.info("Generation job poller started.");
  setInterval(() => pollJobs(io), POLLING_INTERVAL);
};

const pollJobs = async (io: SocketIOServer) => {
  const activeJobs = await GenerationJob.findAll({
    where: { status: ["pending", "processing"] },
  });

  if (activeJobs.length === 0) return;

  for (const job of activeJobs) {
    try {
      let isComplete = false;
      let isFailed = false;
      let externalResultUrl: string | undefined;
      let errorMessage: string | undefined;

      let statusData;

      if (job.service === "ai") {
        const provider = job.meta.provider || "unifically";
        const res = await aiService.checkStatus(job.serviceTaskId, provider);
        statusData = res;

        if (provider === "unifically") {
          if (statusData?.status === "completed") {
            isComplete = true;
            externalResultUrl = statusData.url || statusData.output?.image_url || statusData.image_url;
          } else if (statusData?.status === "failed") {
            isFailed = true;
            errorMessage = statusData.error?.message || "Unifically failed";
          }
        } else {
          // TTAPI
          if (statusData?.status === "SUCCESS" && statusData?.data?.imageUrl) {
            isComplete = true;
            externalResultUrl = statusData.data.imageUrl;
          } else if (statusData?.status === "FAILED") {
            isFailed = true;
            errorMessage = statusData.message || "TTAPI failed";
          }
        }
      }

      else if (job.service.startsWith("gpt")) {
        const res = await getGptImageStatus(job.serviceTaskId, job.service === "gpt-1.5");
        statusData = res.data;
        if (statusData?.status === "completed") {
          isComplete = true;
          externalResultUrl = statusData.url || statusData.output?.image_url || statusData.image_url;
        }
      }
      else if (job.service.startsWith("nano")) {
        const isPro = job.service === "nano-pro";
        const res = await getNanoImageStatus(job.serviceTaskId, isPro);
        statusData = res.data;
        if (statusData?.status === "completed") {
          isComplete = true;
          externalResultUrl = statusData.output?.image_url || statusData.url;
        }
      }
      else if (job.service === "kling") {
        const res = await getKlingVideoStatus(job.serviceTaskId);
        statusData = res.data;
        if (statusData?.status === "completed") {
          isComplete = true;
          externalResultUrl = statusData.video_url || statusData.output?.video_url;
        }
      }
      else if (job.service === "higgsfield") {
        const res = await getHiggsfieldStatus(job.serviceTaskId);
        const hJob = res.jobs?.[0] || res;
        statusData = hJob;
        if (hJob.status === "completed") {
          isComplete = true;
          externalResultUrl = hJob.result?.url;
        } else if (hJob.status === "failed") {
          isFailed = true;
        }
      }

      if (statusData?.status === "failed" && !isFailed) {
        isFailed = true;
        errorMessage = statusData.error?.message || "Unknown error";
      }

      const userSocketId = getUserSocketId(job.userId);

      if (!isComplete && !isFailed && job.status === 'pending') {
        job.status = 'processing';
        await job.save();
        if (userSocketId) io.to(userSocketId).emit("jobUpdate", { type: "processing", jobId: job.id });
      }

      if (isComplete && externalResultUrl) {
        const t = await db.transaction();
        try {
          const freshJob = await GenerationJob.findByPk(job.id, { transaction: t, lock: true });

          if (freshJob?.status === 'completed') {
            await t.rollback();
            continue;
          }

          const { publish, prompt } = job.meta;

          const cost = job.service === "kling" || job.service === "higgsfield" ? 40 : 15;
          await performTransaction(
            job.userId,
            cost,
            "debit",
            `Generation: ${job.service.toUpperCase()}`,
            t
          );

          let resultItem;

          if (job.service === "ai") {
            resultItem = await aiService.processFinalImage(publish, job.userId, externalResultUrl, prompt, t);
          } else if (job.service.startsWith("gpt")) {
            resultItem = await processGpt(publish, job.userId, externalResultUrl, prompt, t);
          } else if (job.service.startsWith("nano")) {
            resultItem = await processNano(publish, job.userId, externalResultUrl, prompt, t);
          } else if (job.service === "kling") {
            resultItem = await processKling(publish, job.userId, externalResultUrl, prompt, t);
          } else if (job.service === "higgsfield") {
            resultItem = await processHiggsfield(publish, job.userId, externalResultUrl, prompt, t);
          }

          job.status = "completed";
          job.resultUrl = resultItem.imageUrl || resultItem.videoUrl;

          await job.save({ transaction: t });
          await t.commit();

          if (userSocketId) {
            io.to(userSocketId).emit("jobUpdate", {
              type: "completed",
              jobId: job.id,
              result: resultItem
            });
          }
        } catch (err) {
          await t.rollback();
          logger.error(`Error saving job ${job.id}: ${err.message}`);
        }
      }

      else if (isFailed) {
        job.status = "failed";
        job.errorMessage = errorMessage;
        await job.save();
        if (userSocketId) {
          io.to(userSocketId).emit("jobUpdate", {
            type: "failed",
            jobId: job.id,
            error: errorMessage
          });
        }
      }

    } catch (e) {
      logger.error(`Poller loop error: ${e.message}`);
    }
  }
};