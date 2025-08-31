import { getUserSocketId } from '../socketManager';
import { Server as SocketIOServer } from 'socket.io';
import { GenerationJob } from '../models/GenerationJob';
import { getKlingVideoStatus } from '../services/klingService';
import { getVideo as getHiggsfieldStatus } from '../services/higgsfieldService';
// NOTE: Add polling functions for GPT and Fal if they become async in the future.
// For now, this worker is primarily for long-running video tasks.

const POLLING_INTERVAL = 15000; // Poll every 15 seconds

export const startJobPoller = (io: SocketIOServer) => {
    console.log('Generation job poller worker started.');
    setInterval(() => pollPendingJobs(io), POLLING_INTERVAL);
};

const pollPendingJobs = async (io: SocketIOServer) => {
    const pendingJobs = await GenerationJob.findAll({ where: { status: 'pending' } });

    if (pendingJobs.length === 0) {
        return; // No jobs to process
    }

    console.log(`Found ${pendingJobs.length} pending jobs to poll.`);

    for (const job of pendingJobs) {
        try {
            let isComplete = false;
            let isFailed = false;
            let resultUrl: string | undefined;
            let errorMessage: string | undefined;

            if (job.service === 'kling') {
                const status = await getKlingVideoStatus(job.serviceTaskId);
                if (status.success && status.data.status === 'completed') {
                    isComplete = true;
                    resultUrl = status.data.video_url;
                } else if (!status.success || status.data.status === 'failed') {
                    isFailed = true;
                    errorMessage = status.message || 'Kling generation failed.';
                }
            } else if (job.service === 'higgsfield') {
                const status = await getHiggsfieldStatus(job.serviceTaskId);
                if (status.jobs && status.jobs[0]) {
                    const higgsJob = status.jobs[0];
                    if (higgsJob.status === 'completed') {
                        isComplete = true;
                        resultUrl = higgsJob.result.url;
                    } else if (higgsJob.status === 'failed') {
                        isFailed = true;
                        errorMessage = 'Higgsfield generation failed.';
                    }
                }
            }
            // Add logic for other async services (GPT, Fal) here if needed.

            const userSocketId = getUserSocketId(job.userId);

            if (isComplete && resultUrl) {
                console.log(`Job ${job.id} completed for user ${job.userId}.`);
                job.status = 'completed';
                job.resultUrl = resultUrl;
                await job.save();

                if (userSocketId) {
                    io.to(userSocketId).emit('jobCompleted', {
                        jobId: job.id,
                        resultUrl: job.resultUrl,
                        prompt: job.prompt,
                        service: job.service
                    });
                }
            } else if (isFailed) {
                console.error(`Job ${job.id} failed for user ${job.userId}.`);
                job.status = 'failed';
                job.errorMessage = errorMessage;
                await job.save();

                if (userSocketId) {
                    io.to(userSocketId).emit('jobFailed', {
                        jobId: job.id,
                        error: job.errorMessage
                    });
                }
            }

        } catch (error) {
            console.error(`Error polling job ${job.id}:`, error.message);
        }
    }
};