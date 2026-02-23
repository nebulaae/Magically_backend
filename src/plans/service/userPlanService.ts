import db from '../../../shared/config/database';
import logger from '../../../shared/utils/logger';
import { Transaction as SequelizeTransaction } from 'sequelize';
import { User } from '../../user/models/User';
import { Plan } from '../models/Plan';
import { UserPlan, UserPlanStatus } from '../models/UserPlan';
import * as userPlanRepository from '../repository/userPlanRepository';
import * as planRepository from '../repository/planRepository';
import * as settingService from '../../admin/service/settingService';

export interface ActiveUserPlanDto {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  planType: string;
  status: UserPlanStatus;
  startDate: Date;
  endDate: Date;
  tokensFromPlan: number;
  tokensFromTopup: number;
  autoRenew: boolean;
  cancelledAt: Date | null;
  gracePeriodEnd: Date | null;
}

export interface TokenBalanceDto {
  tokensFromPlan: number;
  tokensFromTopup: number;
  total: number;
  hasActivePlan: boolean;
}

function toActiveDto(up: UserPlan & { plan?: Plan }): ActiveUserPlanDto {
  const plan = (up as UserPlan & { plan?: Plan }).plan;
  return {
    id: up.id,
    userId: up.userId,
    planId: up.planId,
    planName: plan?.name ?? '',
    planType: plan?.type ?? '',
    status: up.status,
    startDate: up.startDate,
    endDate: up.endDate,
    tokensFromPlan: up.tokensFromPlan,
    tokensFromTopup: up.tokensFromTopup,
    autoRenew: up.autoRenew,
    cancelledAt: up.cancelledAt,
    gracePeriodEnd: up.gracePeriodEnd,
  };
}

export async function getActiveUserPlan(userId: string): Promise<ActiveUserPlanDto | null> {
  try {
    const up = await userPlanRepository.findActiveByUserId(userId);
    if (!up) return null;
    return toActiveDto(up as UserPlan & { plan: Plan });
  } catch (error) {
    logger.error(
      `UserPlanService.getActiveUserPlan failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function createTrialForUser(userId: string): Promise<ActiveUserPlanDto> {
  try {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');
    if (user.hasUsedTrial) {
      throw new Error('Trial already used');
    }
    const settings = await settingService.getSettings();
    const trialTokens = settings.trialTokens ?? 50;
    const trialPeriodDays = settings.trialPeriodDays ?? 7;
    const trialPlan = await Plan.findOne({ where: { name: 'Trial' } });
    if (!trialPlan) throw new Error('Trial plan not found. Run seed:plans.');
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + trialPeriodDays);
    const up = await db.transaction(async (t) => {
      const created = await userPlanRepository.create(
        {
          userId,
          planId: trialPlan.id,
          status: 'trial',
          startDate,
          endDate,
          tokensFromPlan: trialTokens,
          tokensFromTopup: 0,
          autoRenew: false,
        },
        t
      );
      await user.update({ hasUsedTrial: true }, { transaction: t });
      return created;
    });
    const withPlan = await userPlanRepository.findByIdWithPlan(up.id);
    logger.info(`Trial created for user ${userId}`);
    return toActiveDto(withPlan! as UserPlan & { plan: Plan });
  } catch (error) {
    logger.error(
      `UserPlanService.createTrialForUser failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function purchasePackage(userId: string, planId: string): Promise<ActiveUserPlanDto> {
  try {
    const plan = await planRepository.findById(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.type !== 'package') throw new Error('Plan is not a package');
    if (!plan.isActive) throw new Error('Plan is not active');
    if (plan.periodDays == null || plan.periodDays <= 0) throw new Error('Invalid plan period');
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.periodDays);
    const up = await db.transaction(async (t) => {
      return userPlanRepository.create(
        {
          userId,
          planId: plan.id,
          status: 'active',
          startDate,
          endDate,
          tokensFromPlan: plan.tokenAmount,
          tokensFromTopup: 0,
          autoRenew: false,
        },
        t
      );
    });
    const withPlan = await userPlanRepository.findByIdWithPlan(up.id);
    logger.info(`Package purchased: user ${userId}, plan ${plan.name}`);
    return toActiveDto(withPlan! as UserPlan & { plan: Plan });
  } catch (error) {
    logger.error(
      `UserPlanService.purchasePackage failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function subscribe(userId: string, planId: string): Promise<ActiveUserPlanDto> {
  try {
    const plan = await planRepository.findById(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.type !== 'subscription') throw new Error('Plan is not a subscription');
    if (!plan.isActive) throw new Error('Plan is not active');
    if (plan.periodDays == null || plan.periodDays <= 0) throw new Error('Invalid plan period');
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.periodDays);
    const up = await db.transaction(async (t) => {
      return userPlanRepository.create(
        {
          userId,
          planId: plan.id,
          status: 'active',
          startDate,
          endDate,
          tokensFromPlan: plan.tokenAmount,
          tokensFromTopup: 0,
          autoRenew: true,
        },
        t
      );
    });
    const withPlan = await userPlanRepository.findByIdWithPlan(up.id);
    logger.info(`Subscription started: user ${userId}, plan ${plan.name}`);
    return toActiveDto(withPlan! as UserPlan & { plan: Plan });
  } catch (error) {
    logger.error(
      `UserPlanService.subscribe failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function cancelSubscription(userId: string): Promise<ActiveUserPlanDto | null> {
  try {
    const up = await userPlanRepository.findActiveByUserId(userId);
    if (!up) return null;
    const plan = await Plan.findByPk(up.planId);
    if (!plan || plan.type !== 'subscription') throw new Error('No active subscription found');
    if (up.status !== 'active' && up.status !== 'overdue') {
      throw new Error('Subscription is not active');
    }
    const updated = await userPlanRepository.update(up, {
      status: 'cancelled',
      cancelledAt: new Date(),
      autoRenew: false,
    });
    const withPlan = await userPlanRepository.findByIdWithPlan(updated.id);
    logger.info(`Subscription cancelled: user ${userId}`);
    return toActiveDto(withPlan! as UserPlan & { plan: Plan });
  } catch (error) {
    logger.error(
      `UserPlanService.cancelSubscription failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function upgrade(userId: string, newPlanId: string): Promise<ActiveUserPlanDto> {
  try {
    const newPlan = await planRepository.findById(newPlanId);
    if (!newPlan) throw new Error('Plan not found');
    if (newPlan.type !== 'package' && newPlan.type !== 'subscription') {
      throw new Error('Target plan must be package or subscription');
    }
    if (!newPlan.isActive) throw new Error('Plan is not active');
    if (newPlan.periodDays == null || newPlan.periodDays <= 0) throw new Error('Invalid plan period');
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + newPlan.periodDays);
    const up = await db.transaction(async (t) => {
      const current = await userPlanRepository.findActiveByUserId(userId, t);
      if (current) {
        await userPlanRepository.update(current, { status: 'expired' }, t);
      }
      return userPlanRepository.create(
        {
          userId,
          planId: newPlan.id,
          status: 'active',
          startDate,
          endDate,
          tokensFromPlan: newPlan.tokenAmount,
          tokensFromTopup: 0,
          autoRenew: newPlan.type === 'subscription',
        },
        t
      );
    });
    const withPlan = await userPlanRepository.findByIdWithPlan(up.id);
    logger.info(`Upgrade completed: user ${userId}, new plan ${newPlan.name}`);
    return toActiveDto(withPlan! as UserPlan & { plan: Plan });
  } catch (error) {
    logger.error(
      `UserPlanService.upgrade failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function getTokenBalance(userId: string): Promise<TokenBalanceDto> {
  try {
    const up = await userPlanRepository.findActiveByUserId(userId);
    if (!up) {
      return {
        tokensFromPlan: 0,
        tokensFromTopup: 0,
        total: 0,
        hasActivePlan: false,
      };
    }
    return {
      tokensFromPlan: up.tokensFromPlan,
      tokensFromTopup: up.tokensFromTopup,
      total: up.tokensFromPlan + up.tokensFromTopup,
      hasActivePlan: true,
    };
  } catch (error) {
    logger.error(
      `UserPlanService.getTokenBalance failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function consumeTokens(
  userId: string,
  amount: number,
  t?: SequelizeTransaction
): Promise<{ remaining: number }> {
  if (amount <= 0) throw new Error('Amount must be positive');
  const up = await userPlanRepository.findActiveByUserId(userId, t);
  if (!up) throw new Error('No active plan');
  const total = up.tokensFromPlan + up.tokensFromTopup;
  if (total < amount) throw new Error('Insufficient tokens');
  let fromPlan = up.tokensFromPlan;
  let fromTopup = up.tokensFromTopup;
  let remaining = amount;
  if (fromPlan >= remaining) {
    fromPlan -= remaining;
    remaining = 0;
  } else {
    remaining -= fromPlan;
    fromPlan = 0;
    fromTopup -= remaining;
  }
  await userPlanRepository.update(
    up,
    { tokensFromPlan: fromPlan, tokensFromTopup: fromTopup },
    t
  );
  return { remaining: fromPlan + fromTopup };
}
