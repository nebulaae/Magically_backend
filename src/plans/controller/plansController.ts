import { Request, Response } from 'express';
import logger from '../../../shared/utils/logger';
import * as apiResponse from '../../../shared/utils/apiResponse';
import * as planService from '../service/planService';
import * as userPlanService from '../service/userPlanService';
import * as paymentService from '../../payment/service/paymentService';

const handleErrors = (error: unknown, res: Response) => {
  const msg = error instanceof Error ? error.message : String(error);
  logger.error(msg);
  if (msg.includes('not found') || msg.includes('No active'))
    return apiResponse.notFound(res, msg);
  if (msg.includes('already') || msg.includes('required'))
    return apiResponse.badRequest(res, msg);
  if (
    msg.includes('not a ') ||
    msg.includes('Invalid') ||
    msg.includes('not active')
  )
    return apiResponse.badRequest(res, msg);
  return apiResponse.internalError(res, 'Server error');
};

const PLAN_TYPES = ['package', 'subscription', 'topup'] as const;

export const getPlans = async (req: Request, res: Response) => {
  try {
    const type = Array.isArray(req.query.type)
      ? req.query.type[0]
      : req.query.type;
    const currency = Array.isArray(req.query.currency)
      ? req.query.currency[0]
      : req.query.currency;
    if (
      type !== undefined &&
      (typeof type !== 'string' ||
        !PLAN_TYPES.includes(type as (typeof PLAN_TYPES)[number]))
    ) {
      return apiResponse.badRequest(
        res,
        `type must be one of: ${PLAN_TYPES.join(', ')}`
      );
    }
    const plans = await planService.getActivePlans(
      type && typeof type === 'string'
        ? { type: type as (typeof PLAN_TYPES)[number] }
        : {},
      typeof currency === 'string' ? currency : undefined
    );
    return apiResponse.success(res, { plans });
  } catch (error) {
    handleErrors(error, res);
  }
};

export const getPlanById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const currency = Array.isArray(req.query.currency)
      ? req.query.currency[0]
      : req.query.currency;
    if (!id) return apiResponse.badRequest(res, 'Plan id required');
    const plan = await planService.getPlanById(
      id,
      typeof currency === 'string' ? currency : undefined
    );
    if (!plan) return apiResponse.notFound(res, 'Plan not found');
    return apiResponse.success(res, plan);
  } catch (error) {
    handleErrors(error, res);
  }
};

const createPlanPayment = async (
  res: Response,
  userId: string,
  planId: string,
  planOperation: 'package' | 'subscription' | 'topup' | 'upgrade',
  description: string,
  userCurrency?: string,
  quantity?: number,
  topupCustomAmount?: number,
  topupCustomTokenAmount?: number
) => {
  const plan = await planService.getPlanById(planId, userCurrency);
  if (!plan) throw new Error('Plan not found');
  if (!plan.isActive) throw new Error('Plan is not active');
  const normalizedQuantity =
    typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0
      ? Math.floor(quantity)
      : 1;
  const singleAmount =
    plan.priceInUserCurrency != null
      ? plan.priceInUserCurrency
      : Number(plan.price);
  const amount =
    topupCustomAmount != null && topupCustomAmount >= 0
      ? topupCustomAmount
      : singleAmount * normalizedQuantity;
  const currency = plan.userCurrency ?? plan.currency;
  const metadata: Record<string, unknown> = {
    planOperation,
    planId,
    quantity: normalizedQuantity,
  };
  if (
    planOperation === 'topup' &&
    typeof topupCustomTokenAmount === 'number' &&
    Number.isFinite(topupCustomTokenAmount)
  ) {
    metadata.tokenAmount = topupCustomTokenAmount;
  }
  const result = await paymentService.createPaymentWithToken({
    userId,
    amount,
    currency: currency || 'RUB',
    paymentMethod: 'card',
    paymentProvider: 'bepaid',
    description,
    metadata,
  });
  return apiResponse.success(
    res,
    {
      paymentId: result.payment.id,
      redirectUrl: result.redirectUrl,
      paymentToken: result.paymentToken,
    },
    'Payment created'
  );
};

export const purchasePackage = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = req.body?.planId;
    const currency = req.body?.currency;
    if (!planId || typeof planId !== 'string')
      return apiResponse.badRequest(res, 'planId is required');
    const plan = await planService.getPlanById(
      planId,
      typeof currency === 'string' ? currency : undefined
    );
    if (!plan) return apiResponse.notFound(res, 'Plan not found');
    if (plan.type !== 'package')
      return apiResponse.badRequest(res, 'Plan is not a package');
    await createPlanPayment(
      res,
      userId,
      planId,
      'package',
      `Package: ${plan.name}`,
      typeof currency === 'string' ? currency : undefined
    );
  } catch (error) {
    handleErrors(error, res);
  }
};

export const subscribe = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = req.body?.planId;
    const currency = req.body?.currency;
    if (!planId || typeof planId !== 'string')
      return apiResponse.badRequest(res, 'planId is required');
    const plan = await planService.getPlanById(
      planId,
      typeof currency === 'string' ? currency : undefined
    );
    if (!plan) return apiResponse.notFound(res, 'Plan not found');
    if (plan.type !== 'subscription')
      return apiResponse.badRequest(res, 'Plan is not a subscription');
    await createPlanPayment(
      res,
      userId,
      planId,
      'subscription',
      `Subscription: ${plan.name}`,
      typeof currency === 'string' ? currency : undefined
    );
  } catch (error) {
    handleErrors(error, res);
  }
};

export const unsubscribe = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await userPlanService.cancelSubscription(userId);
    if (!result)
      return apiResponse.notFound(res, 'No active subscription found');
    return apiResponse.success(res, { plan: result }, 'Subscription cancelled');
  } catch (error) {
    handleErrors(error, res);
  }
};

export const topup = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = req.body?.planId;
    const currency = req.body?.currency;
    const quantityRaw = req.body?.quantity;
    const amountRaw = req.body?.amount;
    if (!planId || typeof planId !== 'string')
      return apiResponse.badRequest(res, 'planId is required');
    const plan = await planService.getPlanById(
      planId,
      typeof currency === 'string' ? currency : undefined
    );
    if (!plan) return apiResponse.notFound(res, 'Plan not found');
    if (plan.type !== 'topup')
      return apiResponse.badRequest(res, 'Plan is not a top-up');
    const baseTokens = Number(plan.tokenAmount) || 3000;
    const basePrice = Number(
      plan.priceInUserCurrency != null ? plan.priceInUserCurrency : plan.price
    );
    let quantity: number | undefined;
    let customTokenAmount: number | undefined;
    if (
      typeof amountRaw === 'number' &&
      Number.isFinite(amountRaw) &&
      amountRaw >= baseTokens
    ) {
      customTokenAmount = Math.floor(amountRaw);
    } else if (typeof amountRaw === 'string') {
      const parsed = Number.parseInt(amountRaw, 10);
      if (Number.isFinite(parsed) && parsed >= baseTokens)
        customTokenAmount = parsed;
    }
    if (customTokenAmount == null) {
      quantity =
        typeof quantityRaw === 'number'
          ? quantityRaw
          : typeof quantityRaw === 'string'
            ? Number.parseInt(quantityRaw, 10)
            : undefined;
    }
    await createPlanPayment(
      res,
      userId,
      planId,
      'topup',
      `Top-up: ${plan.name}`,
      typeof currency === 'string' ? currency : undefined,
      quantity,
      customTokenAmount != null
        ? Math.round(basePrice * (customTokenAmount / baseTokens))
        : undefined,
      customTokenAmount
    );
  } catch (error) {
    handleErrors(error, res);
  }
};

export const upgrade = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const planId = req.body?.planId;
    const currency = req.body?.currency;
    if (!planId || typeof planId !== 'string')
      return apiResponse.badRequest(res, 'planId is required');
    const plan = await planService.getPlanById(
      planId,
      typeof currency === 'string' ? currency : undefined
    );
    if (!plan) return apiResponse.notFound(res, 'Plan not found');
    if (plan.type !== 'package' && plan.type !== 'subscription')
      return apiResponse.badRequest(
        res,
        'Target plan must be package or subscription'
      );
    await createPlanPayment(
      res,
      userId,
      planId,
      'upgrade',
      `Upgrade: ${plan.name}`,
      typeof currency === 'string' ? currency : undefined
    );
  } catch (error) {
    handleErrors(error, res);
  }
};
