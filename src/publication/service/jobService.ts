import { GenerationJob } from '../models/GenerationJob';
import { createPublication } from '../repository/publicationRepository';
import db from '../../../shared/config/database';

export const publishJobToReel = async (jobId: string, userId: string) => {
  const t = await db.transaction();
  try {
    const job = await GenerationJob.findByPk(jobId, {
      transaction: t,
      lock: true,
    });

    if (!job) throw new Error('Job not found');
    if (job.userId !== userId) throw new Error('Access denied');
    if (job.status !== 'completed') throw new Error('Job not completed');
    if (job.isPublished) throw new Error('Already published');

    await createPublication({
      userId,
      content: job.meta.prompt || 'AI Generated',
      imageUrl: job.resultUrl, // Assuming resultUrl is local path now
      category: 'ai',
    }); // Note: pass 't' if createPublication supports it

    job.isPublished = true;
    await job.save({ transaction: t });

    await t.commit();
    return { success: true };
  } catch (e) {
    await t.rollback();
    throw e;
  }
};
