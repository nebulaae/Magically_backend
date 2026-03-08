import { Request, Response } from 'express';
import logger from '../../../shared/utils/logger';
import * as apiResponse from '../../../shared/utils/apiResponse';
import * as planService from '../../plans/service/planService';
import { PlanType } from '../../plans/models/Plan';

const PLAN_TYPES: PlanType[] = ['package', 'subscription', 'topup'];

const handleErrors = (error: unknown, res: Response) => {
  const msg = error instanceof Error ? error.message : String(error);
  logger.error(msg);
  if (msg.includes('not found')) return apiResponse.notFound(res, msg);
  if (msg.includes('already exists')) return apiResponse.conflict(res, msg);
  if (
    msg.includes('required') ||
    msg.includes('Invalid') ||
    msg.includes('not a ') ||
    msg.includes('must be')
  ) {
    return apiResponse.badRequest(res, msg);
  }
  return apiResponse.internalError(res, 'Server error');
};

export const listPlans = async (req: Request, res: Response) => {
  try {
    const type = Array.isArray(req.query.type)
      ? req.query.type[0]
      : req.query.type;
    const isActive = Array.isArray(req.query.isActive)
      ? req.query.isActive[0]
      : req.query.isActive;

    if (
      type !== undefined &&
      (typeof type !== 'string' || !PLAN_TYPES.includes(type as PlanType))
    ) {
      return apiResponse.badRequest(
        res,
        `type must be one of: ${PLAN_TYPES.join(', ')}`
      );
    }

    const filter: planService.PlanListFilter = {};
    if (type && typeof type === 'string') {
      filter.type = type as PlanType;
    }
    if (isActive !== undefined) {
      if (
        typeof isActive !== 'string' ||
        !['true', 'false'].includes(isActive)
      ) {
        return apiResponse.badRequest(
          res,
          'isActive must be \"true\" or \"false\"'
        );
      }
      filter.isActive = isActive === 'true';
    }

    const plans = await planService.getAllPlans(filter);
    return apiResponse.success(res, { plans });
  } catch (error) {
    handleErrors(error, res);
  }
};

export const createPlan = async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      icon,
      type,
      tokenAmount,
      periodDays,
      price,
      currency,
      isActive,
    } = req.body ?? {};

    if (!name || typeof name !== 'string') {
      return apiResponse.badRequest(res, 'name is required');
    }
    if (
      !type ||
      typeof type !== 'string' ||
      !PLAN_TYPES.includes(type as PlanType)
    ) {
      return apiResponse.badRequest(
        res,
        `type must be one of: ${PLAN_TYPES.join(', ')}`
      );
    }
    if (typeof tokenAmount !== 'number' || tokenAmount < 0) {
      return apiResponse.badRequest(
        res,
        'tokenAmount must be a non-negative number'
      );
    }
    if (typeof price !== 'number' || price < 0) {
      return apiResponse.badRequest(res, 'price must be a non-negative number');
    }

    if (
      (type === 'package' || type === 'subscription') &&
      (!periodDays || periodDays <= 0)
    ) {
      return apiResponse.badRequest(
        res,
        'periodDays must be positive for package and subscription'
      );
    }

    const dto = await planService.createPlan({
      name,
      description,
      icon,
      type: type as PlanType,
      tokenAmount,
      periodDays: periodDays ?? null,
      price,
      currency,
      isActive,
    });
    return apiResponse.success(res, dto, 'Plan created');
  } catch (error) {
    handleErrors(error, res);
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.planId)
      ? req.params.planId[0]
      : req.params.planId;
    if (!id) return apiResponse.badRequest(res, 'Plan id required');

    const {
      name,
      description,
      icon,
      type,
      tokenAmount,
      periodDays,
      price,
      currency,
      isActive,
    } = req.body ?? {};

    if (type !== undefined) {
      if (typeof type !== 'string' || !PLAN_TYPES.includes(type as PlanType)) {
        return apiResponse.badRequest(
          res,
          `type must be one of: ${PLAN_TYPES.join(', ')}`
        );
      }
    }

    const dto = await planService.updatePlan(id, {
      name,
      description,
      icon,
      type,
      tokenAmount,
      periodDays: periodDays ?? null,
      price,
      currency,
      isActive,
    });
    return apiResponse.success(res, dto, 'Plan updated');
  } catch (error) {
    handleErrors(error, res);
  }
};

export const deactivatePlan = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.planId)
      ? req.params.planId[0]
      : req.params.planId;
    if (!id) return apiResponse.badRequest(res, 'Plan id required');
    const dto = await planService.deactivatePlan(id);
    return apiResponse.success(res, dto, 'Plan deactivated');
  } catch (error) {
    handleErrors(error, res);
  }
};
