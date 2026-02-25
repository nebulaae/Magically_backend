import db from '../../shared/config/database';
import { Plan } from '../../src/plans/models/Plan';
import * as planService from '../../src/plans/service/planService';

beforeAll(async () => {
  await Plan.destroy({ where: {} });
});

beforeEach(async () => {
  await Plan.destroy({ where: {} });
});

afterAll(async () => {
  await db.close();
});

describe('PlanService', () => {
  describe('getActivePlans', () => {
    it('returns only active plans', async () => {
      await Plan.create({
        name: 'Active Pack',
        type: 'package',
        tokenAmount: 100,
        periodDays: 7,
        price: 299,
        currency: 'RUB',
        isActive: true,
      });
      await Plan.create({
        name: 'Inactive Pack',
        type: 'package',
        tokenAmount: 200,
        periodDays: 30,
        price: 499,
        currency: 'RUB',
        isActive: false,
      });
      const plans = await planService.getActivePlans({});
      expect(plans).toHaveLength(1);
      expect(plans[0].name).toBe('Active Pack');
      expect(plans[0].isActive).toBe(true);
    });

    it('filters by type when provided', async () => {
      await Plan.create({
        name: 'Pkg A',
        type: 'package',
        tokenAmount: 100,
        periodDays: 7,
        price: 299,
        currency: 'RUB',
        isActive: true,
      });
      await Plan.create({
        name: 'Sub B',
        type: 'subscription',
        tokenAmount: 200,
        periodDays: 30,
        price: 499,
        currency: 'RUB',
        isActive: true,
      });
      const packages = await planService.getActivePlans({ type: 'package' });
      expect(packages).toHaveLength(1);
      expect(packages[0].type).toBe('package');
      const subs = await planService.getActivePlans({ type: 'subscription' });
      expect(subs).toHaveLength(1);
      expect(subs[0].type).toBe('subscription');
    });

    it('returns plans without conversion when currency is RUB or omitted', async () => {
      await Plan.create({
        name: 'RUB Plan',
        type: 'package',
        tokenAmount: 100,
        periodDays: 7,
        price: 299,
        currency: 'RUB',
        isActive: true,
      });
      const withoutCurrency = await planService.getActivePlans({});
      expect(withoutCurrency[0].price).toBe(299);
      expect(withoutCurrency[0].priceInUserCurrency).toBeUndefined();
      const withRUB = await planService.getActivePlans({}, 'RUB');
      expect(withRUB[0].price).toBe(299);
      expect(withRUB[0].priceInUserCurrency).toBeUndefined();
    });

    it('returns plans with priceInUserCurrency when userCurrency is not RUB', async () => {
      await Plan.create({
        name: 'USD Plan',
        type: 'package',
        tokenAmount: 100,
        periodDays: 7,
        price: 100,
        currency: 'RUB',
        isActive: true,
      });
      const plans = await planService.getActivePlans({}, 'USD');
      expect(plans).toHaveLength(1);
      expect(plans[0].price).toBe(100);
      expect(plans[0].priceInUserCurrency).toBeDefined();
      expect(typeof plans[0].priceInUserCurrency).toBe('number');
      expect(plans[0].userCurrency).toBe('USD');
    });
  });

  describe('getPlanById', () => {
    it('returns plan when found', async () => {
      const created = await Plan.create({
        name: 'ById Plan',
        type: 'subscription',
        tokenAmount: 200,
        periodDays: 30,
        price: 499,
        currency: 'RUB',
        isActive: true,
      });
      const plan = await planService.getPlanById(created.id);
      expect(plan).not.toBeNull();
      expect(plan!.id).toBe(created.id);
      expect(plan!.name).toBe('ById Plan');
      expect(Number(plan!.price)).toBe(499);
    });

    it('returns null when not found', async () => {
      const plan = await planService.getPlanById('00000000-0000-0000-0000-000000000000');
      expect(plan).toBeNull();
    });

    it('returns plan with priceInUserCurrency when userCurrency provided', async () => {
      const created = await Plan.create({
        name: 'ById USD',
        type: 'package',
        tokenAmount: 50,
        periodDays: 7,
        price: 100,
        currency: 'RUB',
        isActive: true,
      });
      const plan = await planService.getPlanById(created.id, 'USD');
      expect(plan).not.toBeNull();
      expect(plan!.priceInUserCurrency).toBeDefined();
      expect(plan!.userCurrency).toBe('USD');
    });
  });

  describe('createPlan', () => {
    it('creates plan and returns dto', async () => {
      const dto = await planService.createPlan({
        name: 'New Pack',
        description: 'New description',
        type: 'package',
        tokenAmount: 150,
        periodDays: 14,
        price: 399,
        currency: 'RUB',
      });
      expect(dto.id).toBeDefined();
      expect(dto.name).toBe('New Pack');
      expect(dto.description).toBe('New description');
      expect(dto.type).toBe('package');
      expect(dto.tokenAmount).toBe(150);
      expect(dto.periodDays).toBe(14);
      expect(dto.price).toBe(399);
      expect(dto.currency).toBe('RUB');
      expect(dto.isActive).toBe(true);
      const inDb = await Plan.findByPk(dto.id);
      expect(inDb).not.toBeNull();
      expect(inDb!.name).toBe('New Pack');
    });

    it('throws when plan with same name exists', async () => {
      await Plan.create({
        name: 'Unique Name',
        type: 'package',
        tokenAmount: 100,
        periodDays: 7,
        price: 299,
        currency: 'RUB',
        isActive: true,
      });
      await expect(
        planService.createPlan({
          name: 'Unique Name',
          type: 'subscription',
          tokenAmount: 200,
          periodDays: 30,
          price: 499,
          currency: 'RUB',
        })
      ).rejects.toThrow('already exists');
    });
  });

  describe('updatePlan', () => {
    it('updates plan and returns dto', async () => {
      const created = await Plan.create({
        name: 'To Update',
        type: 'package',
        tokenAmount: 100,
        periodDays: 7,
        price: 299,
        currency: 'RUB',
        isActive: true,
      });
      const dto = await planService.updatePlan(created.id, {
        name: 'Updated Name',
        price: 349,
      });
      expect(dto.name).toBe('Updated Name');
      expect(dto.price).toBe(349);
      const inDb = await Plan.findByPk(created.id);
      expect(inDb!.name).toBe('Updated Name');
      expect(Number(inDb!.price)).toBe(349);
    });

    it('throws when plan not found', async () => {
      await expect(
        planService.updatePlan('00000000-0000-0000-0000-000000000000', {
          name: 'Any',
        })
      ).rejects.toThrow('Plan not found');
    });

    it('throws when new name already exists for another plan', async () => {
      await Plan.create({
        name: 'Existing',
        type: 'package',
        tokenAmount: 100,
        periodDays: 7,
        price: 299,
        currency: 'RUB',
        isActive: true,
      });
      const other = await Plan.create({
        name: 'Other',
        type: 'package',
        tokenAmount: 200,
        periodDays: 30,
        price: 499,
        currency: 'RUB',
        isActive: true,
      });
      await expect(
        planService.updatePlan(other.id, { name: 'Existing' })
      ).rejects.toThrow('already exists');
    });
  });

  describe('deactivatePlan', () => {
    it('sets isActive to false', async () => {
      const created = await Plan.create({
        name: 'To Deactivate',
        type: 'package',
        tokenAmount: 100,
        periodDays: 7,
        price: 299,
        currency: 'RUB',
        isActive: true,
      });
      const dto = await planService.deactivatePlan(created.id);
      expect(dto.isActive).toBe(false);
      const inDb = await Plan.findByPk(created.id);
      expect(inDb!.isActive).toBe(false);
    });

    it('throws when plan not found', async () => {
      await expect(
        planService.deactivatePlan('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Plan not found');
    });
  });

  describe('activatePlan', () => {
    it('sets isActive to true', async () => {
      const created = await Plan.create({
        name: 'To Activate',
        type: 'package',
        tokenAmount: 100,
        periodDays: 7,
        price: 299,
        currency: 'RUB',
        isActive: false,
      });
      const dto = await planService.activatePlan(created.id);
      expect(dto.isActive).toBe(true);
      const inDb = await Plan.findByPk(created.id);
      expect(inDb!.isActive).toBe(true);
    });

    it('throws when plan not found', async () => {
      await expect(
        planService.activatePlan('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Plan not found');
    });
  });
});
