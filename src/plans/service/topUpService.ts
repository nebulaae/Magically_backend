import db from '../../../shared/config/database';
import logger from '../../../shared/utils/logger';
import { PlanDto } from './planService';
import * as planService from './planService';
import * as userPlanRepository from '../repository/userPlanRepository';
import * as planRepository from '../repository/planRepository';
import * as topUpRepository from '../repository/topUpRepository';

export async function getAvailableTopUpPlans(
  userCurrency?: string
): Promise<PlanDto[]> {
  try {
    return planService.getActivePlans({ type: 'topup' }, userCurrency);
  } catch (error) {
    logger.error(
      `TopUpService.getAvailableTopUpPlans failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export interface PurchaseTopUpResult {
  topUpId: string;
  userPlanId: string;
  tokenAmount: number;
  tokensFromTopupTotal: number;
  expiresAt: Date;
}

export async function purchaseTopUp(
  userId: string,
  planId: string,
  paymentId?: string | null
): Promise<PurchaseTopUpResult> {
  try {
    const userPlan = await userPlanRepository.findActiveByUserId(userId);
    if (!userPlan) {
      throw new Error('Active plan required to purchase top-up');
    }
    const plan = await planRepository.findById(planId);
    if (!plan) throw new Error('Plan not found');
    if (plan.type !== 'topup') {
      throw new Error('Plan is not a top-up plan');
    }
    if (!plan.isActive) throw new Error('Plan is not active');
    const expiresAt = new Date(userPlan.endDate);
    const result = await db.transaction(async (t) => {
      const topUp = await topUpRepository.create(
        {
          userId,
          userPlanId: userPlan.id,
          tokenAmount: plan.tokenAmount,
          price: plan.price,
          currency: plan.currency,
          paymentId: paymentId ?? null,
          expiresAt,
        },
        t
      );
      const newTotal = userPlan.tokensFromTopup + plan.tokenAmount;
      await userPlanRepository.update(
        userPlan,
        { tokensFromTopup: newTotal },
        t
      );
      return {
        topUpId: topUp.id,
        userPlanId: userPlan.id,
        tokenAmount: plan.tokenAmount,
        tokensFromTopupTotal: newTotal,
        expiresAt,
      };
    });
    logger.info(
      `Top-up purchased: user ${userId}, plan ${plan.name}, +${plan.tokenAmount} tokens`
    );
    return result;
  } catch (error) {
    logger.error(
      `TopUpService.purchaseTopUp failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function getTopUpBalance(userId: string): Promise<number> {
  try {
    const userPlan = await userPlanRepository.findActiveByUserId(userId);
    if (!userPlan) return 0;
    return userPlan.tokensFromTopup;
  } catch (error) {
    logger.error(
      `TopUpService.getTopUpBalance failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}
