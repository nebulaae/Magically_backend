import db from '../../../shared/config/database';
import logger from '../../../shared/utils/logger';
import * as userPlanRepository from '../repository/userPlanRepository';

export const processExpirations = async (now: Date = new Date()) => {
  await processExpiredTrials(now);
  await processExpiredPlans(now);
};

const processExpiredTrials = async (now: Date) => {
  const trials = await userPlanRepository.findExpiredTrials(now);
  for (const up of trials) {
    try {
      await expireTrial(up.id);
    } catch (error: unknown) {
      logger.error(
        `TokenExpirationService.processExpiredTrials failed for userPlan ${up.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

const processExpiredPlans = async (now: Date) => {
  const plans = await userPlanRepository.findExpiredPlans(now);
  for (const up of plans) {
    try {
      await expirePlan(up.id);
    } catch (error: unknown) {
      logger.error(
        `TokenExpirationService.processExpiredPlans failed for userPlan ${up.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

const expireTrial = async (userPlanId: string) => {
  await db.transaction(async (t) => {
    const up = await userPlanRepository.findById(userPlanId, t);
    if (!up) throw new Error('UserPlan not found');
    if (up.status !== 'trial') return;

    await userPlanRepository.update(
      up,
      {
        status: 'noplan',
        tokensFromPlan: 0,
        tokensFromTopup: 0,
      },
      t
    );
  });
};

const expirePlan = async (userPlanId: string) => {
  await db.transaction(async (t) => {
    const up = await userPlanRepository.findById(userPlanId, t);
    if (!up) throw new Error('UserPlan not found');
    if (up.status !== 'active' && up.status !== 'cancelled') return;

    await userPlanRepository.update(
      up,
      {
        status: 'expired',
        tokensFromPlan: 0,
        tokensFromTopup: 0,
      },
      t
    );
  });
};
