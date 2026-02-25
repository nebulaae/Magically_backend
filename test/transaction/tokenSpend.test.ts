import db from '../../shared/config/database';
import { User } from '../../src/user/models/User';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';
import {
  getSpendableBalance,
  canSpendTokens,
  spendTokens,
} from '../../src/transaction/service/transactionService';

const TEST_EMAIL = 'token-spend@test.com';

beforeAll(async () => {
  await UserPlan.destroy({ where: {} });
  await Plan.destroy({ where: {} });
  await User.destroy({ where: { email: TEST_EMAIL } });
});

beforeEach(async () => {
  await UserPlan.destroy({ where: {} });
  await User.destroy({ where: { email: TEST_EMAIL } });
});

afterAll(async () => {
  await db.close();
});

describe('Token spend (plan + legacy)', () => {
  let userId: string;
  let packagePlanId: string;

  beforeEach(async () => {
    const user = await User.create({
      email: TEST_EMAIL,
      username: 'tokenspend',
      fullname: 'Token Spend Test',
      password: 'hash',
      tokens: 100,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: true,
    });
    userId = user.id;
    let pkg = await Plan.findOne({ where: { name: 'Pack', type: 'package' } });
    if (!pkg) {
      pkg = await Plan.create({
        name: 'Pack',
        type: 'package',
        tokenAmount: 50,
        periodDays: 30,
        price: 999,
        currency: 'RUB',
        isActive: true,
      });
    }
    packagePlanId = pkg.id;
  });

  describe('getSpendableBalance', () => {
    it('returns legacy balance when user has no active plan', async () => {
      const result = await getSpendableBalance(userId);
      expect(result.source).toBe('legacy');
      expect(result.balance).toBe(100);
    });

    it('returns plan balance when user has active plan with tokens', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 50,
        tokensFromTopup: 10,
        autoRenew: false,
      });
      const result = await getSpendableBalance(userId);
      expect(result.source).toBe('plan');
      expect(result.balance).toBe(60);
    });

    it('returns legacy when plan exists but balance is zero', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 0,
        tokensFromTopup: 0,
        autoRenew: false,
      });
      const result = await getSpendableBalance(userId);
      expect(result.source).toBe('legacy');
      expect(result.balance).toBe(100);
    });
  });

  describe('canSpendTokens', () => {
    it('returns true when legacy balance sufficient', async () => {
      expect(await canSpendTokens(userId, 50)).toBe(true);
      expect(await canSpendTokens(userId, 100)).toBe(true);
    });

    it('returns false when legacy balance insufficient', async () => {
      expect(await canSpendTokens(userId, 101)).toBe(false);
    });

    it('returns true when plan balance sufficient', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 30,
        tokensFromTopup: 0,
        autoRenew: false,
      });
      expect(await canSpendTokens(userId, 30)).toBe(true);
      expect(await canSpendTokens(userId, 25)).toBe(true);
    });

    it('returns false when plan balance insufficient and legacy zero', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 10,
        tokensFromTopup: 0,
        autoRenew: false,
      });
      await User.update({ tokens: 0 }, { where: { id: userId } });
      expect(await canSpendTokens(userId, 15)).toBe(false);
    });
  });

  describe('spendTokens', () => {
    it('debits from plan when user has active plan', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 50,
        tokensFromTopup: 10,
        autoRenew: false,
      });
      await spendTokens(userId, 30, 'Test spend');
      const up = await UserPlan.findOne({
        where: { userId, status: 'active' },
      });
      expect(up!.tokensFromPlan).toBe(20);
      expect(up!.tokensFromTopup).toBe(10);
      const user = await User.findByPk(userId);
      expect(user!.tokens).toBe(100);
    });

    it('debits from legacy when user has no plan', async () => {
      await spendTokens(userId, 40, 'Test spend');
      const user = await User.findByPk(userId);
      expect(user!.tokens).toBe(60);
    });

    it('falls back to legacy when plan has insufficient tokens', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 5,
        tokensFromTopup: 0,
        autoRenew: false,
      });
      await spendTokens(userId, 10, 'Test spend');
      const up = await UserPlan.findOne({
        where: { userId, status: 'active' },
      });
      expect(up!.tokensFromPlan).toBe(5);
      const user = await User.findByPk(userId);
      expect(user!.tokens).toBe(90);
    });

    it('spends from plan first then topup within plan', async () => {
      const start = new Date();
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserPlan.create({
        userId,
        planId: packagePlanId,
        status: 'active',
        startDate: start,
        endDate: end,
        tokensFromPlan: 10,
        tokensFromTopup: 20,
        autoRenew: false,
      });
      await spendTokens(userId, 15, 'Test spend');
      const up = await UserPlan.findOne({
        where: { userId, status: 'active' },
      });
      expect(up!.tokensFromPlan).toBe(0);
      expect(up!.tokensFromTopup).toBe(15);
    });
  });
});
