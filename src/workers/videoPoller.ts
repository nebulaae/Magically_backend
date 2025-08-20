import { VideoJob } from '../models/VideoJob';
import { getUserSocketId } from '../socketManager';
import { Server as SocketIOServer } from 'socket.io';
import { getKlingVideoStatus } from '../services/klingService';
import { getVideo as getHiggsfieldStatus } from '../services/higgsfieldService';

const POLLING_INTERVAL = 15000; // Poll every 15 seconds

export const startVideoPoller = (io: SocketIOServer) => {
    console.log('Video poller worker started.');
    setInterval(() => pollPendingJobs(io), POLLING_INTERVAL);
};

const pollPendingJobs = async (io: SocketIOServer) => {
    const pendingJobs = await VideoJob.findAll({ where: { status: 'pending' } });

    if (pendingJobs.length === 0) {
        return; // No jobs to process
    }

    console.log(`Found ${pendingJobs.length} pending jobs to poll.`);

    for (const job of pendingJobs) {
        try {
            let isComplete = false;
            let isFailed = false;
            let videoUrl: string | undefined;
            let errorMessage: string | undefined;

            if (job.service === 'kling') {
                const status = await getKlingVideoStatus(job.serviceTaskId);
                if (status.success && status.data.status === 'completed') {
                    isComplete = true;
                    videoUrl = status.data.video_url;
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
                        videoUrl = higgsJob.result.url;
                    } else if (higgsJob.status === 'failed') {
                        isFailed = true;
                        errorMessage = 'Higgsfield generation failed.';
                    }
                }
            }

            const userSocketId = getUserSocketId(job.userId);

            if (isComplete && videoUrl) {
                console.log(`Job ${job.id} completed for user ${job.userId}.`);
                job.status = 'completed';
                job.videoUrl = videoUrl;
                await job.save();

                if (userSocketId) {
                    io.to(userSocketId).emit('jobCompleted', {
                        jobId: job.id,
                        videoUrl: job.videoUrl,
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
