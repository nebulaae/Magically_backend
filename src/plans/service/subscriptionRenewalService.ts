import db from '../../../shared/config/database';
import logger from '../../../shared/utils/logger';
import { Plan } from '../models/Plan';
import { UserPlan } from '../models/UserPlan';
import * as userPlanRepository from '../repository/userPlanRepository';
import * as planRepository from '../repository/planRepository';
import * as settingService from '../../admin/service/settingService';

type ChargeResult = 'success' | 'failed';

interface RenewalSettings {
  subscriptionGracePeriodDays?: number;
}

type ChargeFn = (args: {
  userId: string;
  planId: string;
  userPlanId: string;
  amount: number;
  currency: string;
}) => Promise<ChargeResult>;

let chargeFn: ChargeFn = async () => {
  throw new Error('Recurring payment is not configured');
};

export const setChargeFn = (fn: ChargeFn) => {
  chargeFn = fn;
};

export const processRenewals = async (now: Date = new Date()) => {
  const candidates = await userPlanRepository.findSubscriptionsToRenew(now);
  if (!candidates.length) return;

  const settings = (await settingService.getSettings()) as RenewalSettings;
  const graceDays = settings.subscriptionGracePeriodDays ?? 3;

  for (const up of candidates) {
    const plan = (up as UserPlan & { plan?: Plan }).plan;
    if (!plan || plan.type !== 'subscription') continue;

    try {
      const result = await chargeFn({
        userId: up.userId,
        planId: up.planId,
        userPlanId: up.id,
        amount: Number(plan.price),
        currency: plan.currency,
      });

      if (result === 'success') {
        await renewPeriod(up.id, now);
      } else {
        await markOverdue(up.id, now, graceDays);
      }
    } catch (error: unknown) {
      logger.error(
        `SubscriptionRenewalService.processRenewals failed for userPlan ${up.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export const processGraceExpirations = async (now: Date = new Date()) => {
  const overdue = await userPlanRepository.findOverdueToExpire(now);
  if (!overdue.length) return;

  for (const up of overdue) {
    try {
      await expireOverdue(up.id);
    } catch (error: unknown) {
      logger.error(
        `SubscriptionRenewalService.processGraceExpirations failed for userPlan ${up.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

const renewPeriod = async (userPlanId: string, now: Date) => {
  await db.transaction(async (t) => {
    const up = await userPlanRepository.findById(userPlanId, t);
    if (!up) throw new Error('UserPlan not found');

    const plan = await planRepository.findById(up.planId, t);
    if (!plan) throw new Error('Plan not found');
    if (plan.type !== 'subscription') {
      throw new Error('Plan is not a subscription');
    }
    if (!plan.isActive) {
      throw new Error('Plan is not active');
    }
    if (!plan.periodDays || plan.periodDays <= 0) {
      throw new Error('Invalid plan period');
    }

    const startDate = new Date(now);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.periodDays);

    await userPlanRepository.update(
      up,
      {
        status: 'active',
        startDate,
        endDate,
        tokensFromPlan: plan.tokenAmount,
        tokensFromTopup: 0,
        gracePeriodEnd: null,
        cancelledAt: null,
      },
      t
    );
  });
};

const markOverdue = async (userPlanId: string, now: Date, graceDays: number) => {
  const up = await userPlanRepository.findById(userPlanId);
  if (!up) throw new Error('UserPlan not found');

  const graceUntil = new Date(now);
  graceUntil.setDate(graceUntil.getDate() + graceDays);

  await userPlanRepository.update(up, {
    status: 'overdue',
    gracePeriodEnd: graceUntil,
  });
};

const expireOverdue = async (userPlanId: string) => {
  await db.transaction(async (t) => {
    const up = await userPlanRepository.findById(userPlanId, t);
    if (!up) throw new Error('UserPlan not found');
    if (up.status !== 'overdue') return;

    await userPlanRepository.update(
      up,
      {
        status: 'expired',
        tokensFromPlan: 0,
        tokensFromTopup: 0,
        autoRenew: false,
        gracePeriodEnd: null,
      },
      t
    );
  });
};

