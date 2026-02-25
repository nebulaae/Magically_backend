import db from '../../shared/config/database';
import { User } from '../../src/user/models/User';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';
import { TopUp } from '../../src/plans/models/TopUp';
import * as topUpService from '../../src/plans/service/topUpService';

const TEST_EMAIL = 'topup-service@test.com';

beforeAll(async () => {
  await TopUp.destroy({ where: {} });
  await UserPlan.destroy({ where: {} });
  await Plan.destroy({ where: {} });
  await User.destroy({ where: { email: TEST_EMAIL } });
});

beforeEach(async () => {
  await TopUp.destroy({ where: {} });
  await UserPlan.destroy({ where: {} });
  await User.destroy({ where: { email: TEST_EMAIL } });
});

afterAll(async () => {
  await db.close();
});

describe('TopUpService', () => {
  let userId: string;
  let topUpPlanId: string;
  let packagePlanId: string;

  beforeEach(async () => {
    const user = await User.create({
      email: TEST_EMAIL,
      username: 'topupsvc',
      fullname: 'TopUp Service Test',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: true,
    });
    userId = user.id;
    let topUpPlan = await Plan.findOne({ where: { type: 'topup' } });
    if (!topUpPlan) {
      topUpPlan = await Plan.create({
        name: 'Top-up 100',
        type: 'topup',
        tokenAmount: 100,
        periodDays: null,
        price: 99,
        currency: 'RUB',
        isActive: true,
      });
    }
    topUpPlanId = topUpPlan.id;
    let pkg = await Plan.findOne({ where: { name: 'Pack', type: 'package' } });
    if (!pkg) {
      pkg = await Plan.create({
        name: 'Pack',
        type: 'package',
        tokenAmount: 100,
        periodDays: 30,
        price: 999,
        currency: 'RUB',
        isActive: true,
      });
    }
    packagePlanId = pkg.id;
  });

  describe('getAvailableTopUpPlans', () => {
    it('returns list of active topup plans', async () => {
      const plans = await topUpService.getAvailableTopUpPlans();
      expect(Array.isArray(plans)).toBe(true);
      const topupPlans = plans.filter((p) => p.type === 'topup');
      expect(topupPlans.length).toBeGreaterThanOrEqual(1);
      expect(topupPlans.some((p) => p.id === topUpPlanId)).toBe(true);
    });

    it('accepts userCurrency for conversion', async () => {
      const plans = await topUpService.getAvailableTopUpPlans('RUB');
      expect(plans.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('purchaseTopUp', () => {
    it('throws when user has no active plan', async () => {
      await expect(
        topUpService.purchaseTopUp(userId, topUpPlanId)
      ).rejects.toThrow('Active plan required');
    });

    it('creates topup and increases tokensFromTopup', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const userPlan = await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 50,
        tokensFromTopup: 0,
        autoRenew: false,
      });
      const plan = await Plan.findByPk(topUpPlanId);
      const result = await topUpService.purchaseTopUp(userId, topUpPlanId);
      expect(result.topUpId).toBeDefined();
      expect(result.userPlanId).toBe(userPlan.id);
      expect(result.tokenAmount).toBe(plan!.tokenAmount);
      expect(result.tokensFromTopupTotal).toBe(plan!.tokenAmount);
      expect(result.expiresAt.getTime()).toBe(end.getTime());
      const topUp = await TopUp.findByPk(result.topUpId);
      expect(topUp).not.toBeNull();
      expect(topUp!.userId).toBe(userId);
      expect(topUp!.userPlanId).toBe(userPlan.id);
      const up = await UserPlan.findByPk(userPlan.id);
      expect(up!.tokensFromTopup).toBe(plan!.tokenAmount);
    });

    it('allows multiple topups and accumulates balance', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 50,
        tokensFromTopup: 0,
        autoRenew: false,
      });
      const plan = await Plan.findByPk(topUpPlanId);
      await topUpService.purchaseTopUp(userId, topUpPlanId);
      const result2 = await topUpService.purchaseTopUp(userId, topUpPlanId);
      expect(result2.tokensFromTopupTotal).toBe(plan!.tokenAmount * 2);
    });

    it('throws when plan is not topup', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 50,
        tokensFromTopup: 0,
        autoRenew: false,
      });
      await expect(
        topUpService.purchaseTopUp(userId, packagePlanId)
      ).rejects.toThrow('not a top-up plan');
    });

    it('throws when plan not found', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 50,
        tokensFromTopup: 0,
        autoRenew: false,
      });
      await expect(
        topUpService.purchaseTopUp(
          userId,
          '00000000-0000-0000-0000-000000000000'
        )
      ).rejects.toThrow('Plan not found');
    });
  });

  describe('getTopUpBalance', () => {
    it('returns 0 when no active plan', async () => {
      const balance = await topUpService.getTopUpBalance(userId);
      expect(balance).toBe(0);
    });

    it('returns tokensFromTopup when user has active plan with topup', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 50,
        tokensFromTopup: 0,
        autoRenew: false,
      });
      expect(await topUpService.getTopUpBalance(userId)).toBe(0);
      await topUpService.purchaseTopUp(userId, topUpPlanId);
      const plan = await Plan.findByPk(topUpPlanId);
      expect(await topUpService.getTopUpBalance(userId)).toBe(plan!.tokenAmount);
    });
  });
});
