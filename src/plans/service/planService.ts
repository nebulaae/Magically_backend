import logger from '../../../shared/utils/logger';
import { Plan, PlanType } from '../models/Plan';
import * as planRepository from '../repository/planRepository';
import { convertFromRUB } from '../../payment/service/currencyConversionService';

export interface PlanListFilter {
  type?: PlanType;
}

export interface PlanCreateInput {
  name: string;
  description?: string | null;
  icon?: string | null;
  type: PlanType;
  tokenAmount: number;
  periodDays: number | null;
  price: number;
  currency?: string;
  isActive?: boolean;
}

export interface PlanUpdateInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  type?: PlanType;
  tokenAmount?: number;
  periodDays?: number | null;
  price?: number;
  currency?: string;
  isActive?: boolean;
}

export interface PlanDto {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: PlanType;
  tokenAmount: number;
  periodDays: number | null;
  price: number;
  currency: string;
  priceInUserCurrency?: number;
  userCurrency?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function planToDto(
  plan: Plan,
  userCurrency?: string,
  priceInUserCurrency?: number
): PlanDto {
  const price = Number(plan.price);
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description ?? null,
    icon: plan.icon ?? null,
    type: plan.type,
    tokenAmount: plan.tokenAmount,
    periodDays: plan.periodDays,
    price,
    currency: plan.currency,
    ...(userCurrency != null &&
      priceInUserCurrency != null && {
        priceInUserCurrency,
        userCurrency,
      }),
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

export async function getActivePlans(
  filter: PlanListFilter = {},
  userCurrency?: string
): Promise<PlanDto[]> {
  try {
    const isActive = true;
    const plans = await planRepository.findAll(
      { ...filter, isActive },
      undefined
    );
    if (!userCurrency || userCurrency.toUpperCase() === 'RUB') {
      return plans.map((p) => planToDto(p));
    }
    const targetCurrency = userCurrency.toUpperCase();
    const dtos: PlanDto[] = [];
    for (const plan of plans) {
      const priceRUB = Number(plan.price);
      const converted = await convertFromRUB(priceRUB, targetCurrency);
      dtos.push(planToDto(plan, targetCurrency, Math.round(converted * 100) / 100));
    }
    return dtos;
  } catch (error) {
    logger.error(
      `PlanService.getActivePlans failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function getPlanById(
  id: string,
  userCurrency?: string
): Promise<PlanDto | null> {
  try {
    const plan = await planRepository.findById(id);
    if (!plan) return null;
    if (!userCurrency || userCurrency.toUpperCase() === 'RUB') {
      return planToDto(plan);
    }
    const targetCurrency = userCurrency.toUpperCase();
    const priceRUB = Number(plan.price);
    const converted = await convertFromRUB(priceRUB, targetCurrency);
    return planToDto(plan, targetCurrency, Math.round(converted * 100) / 100);
  } catch (error) {
    logger.error(
      `PlanService.getPlanById failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function createPlan(data: PlanCreateInput): Promise<PlanDto> {
  try {
    const existing = await planRepository.countByName(data.name);
    if (existing > 0) {
      throw new Error(`Plan with name "${data.name}" already exists`);
    }
    const plan = await planRepository.create({
      name: data.name,
      description: data.description ?? null,
      icon: data.icon ?? null,
      type: data.type,
      tokenAmount: data.tokenAmount,
      periodDays: data.periodDays,
      price: data.price,
      currency: data.currency ?? 'RUB',
      isActive: data.isActive ?? true,
    });
    logger.info(`Plan created: ${plan.id} (${plan.name})`);
    return planToDto(plan);
  } catch (error) {
    logger.error(
      `PlanService.createPlan failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function updatePlan(
  id: string,
  data: PlanUpdateInput
): Promise<PlanDto> {
  try {
    const plan = await planRepository.findById(id);
    if (!plan) throw new Error('Plan not found');
    if (data.name != null) {
      const existing = await planRepository.countByName(data.name, id);
      if (existing > 0) throw new Error(`Plan with name "${data.name}" already exists`);
    }
    const updated = await planRepository.update(plan, {
      ...(data.name != null && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.type != null && { type: data.type }),
      ...(data.tokenAmount != null && { tokenAmount: data.tokenAmount }),
      ...(data.periodDays !== undefined && { periodDays: data.periodDays }),
      ...(data.price != null && { price: data.price }),
      ...(data.currency != null && { currency: data.currency }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    });
    logger.info(`Plan updated: ${id}`);
    return planToDto(updated);
  } catch (error) {
    logger.error(
      `PlanService.updatePlan failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function deactivatePlan(id: string): Promise<PlanDto> {
  try {
    const plan = await planRepository.findById(id);
    if (!plan) throw new Error('Plan not found');
    const updated = await planRepository.update(plan, { isActive: false });
    logger.info(`Plan deactivated: ${id}`);
    return planToDto(updated);
  } catch (error) {
    logger.error(
      `PlanService.deactivatePlan failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}

export async function activatePlan(id: string): Promise<PlanDto> {
  try {
    const plan = await planRepository.findById(id);
    if (!plan) throw new Error('Plan not found');
    const updated = await planRepository.update(plan, { isActive: true });
    logger.info(`Plan activated: ${id}`);
    return planToDto(updated);
  } catch (error) {
    logger.error(
      `PlanService.activatePlan failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
}
