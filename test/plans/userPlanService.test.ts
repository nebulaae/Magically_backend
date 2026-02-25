import db from '../../shared/config/database';
import { User } from '../../src/user/models/User';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';
import * as userPlanService from '../../src/plans/service/userPlanService';

jest.mock('../../src/admin/service/settingService', () => ({
  getSettings: jest.fn().mockResolvedValue({ trialTokens: 50, trialPeriodDays: 7 }),
}));

const TEST_EMAIL = 'userplan-service@test.com';

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

describe('UserPlanService', () => {
  let userId: string;
  let trialPlanId: string;
  let packagePlanId: string;
  let subscriptionPlanId: string;

  beforeEach(async () => {
    const user = await User.create({
      email: TEST_EMAIL,
      username: 'userplansvc',
      fullname: 'User Plan Service Test',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: false,
    });
    userId = user.id;
    let trial = await Plan.findOne({ where: { name: 'Trial' } });
    if (!trial) {
      trial = await Plan.create({
        name: 'Trial',
        type: 'package',
        tokenAmount: 50,
        periodDays: 7,
        price: 0,
        currency: 'RUB',
        isActive: true,
      });
    }
    trialPlanId = trial.id;
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
    let sub = await Plan.findOne({ where: { name: 'Sub', type: 'subscription' } });
    if (!sub) {
      sub = await Plan.create({
        name: 'Sub',
        type: 'subscription',
        tokenAmount: 200,
        periodDays: 30,
        price: 499,
        currency: 'RUB',
        isActive: true,
      });
    }
    subscriptionPlanId = sub.id;
  });

  describe('getActiveUserPlan', () => {
    it('returns null when user has no active plan', async () => {
      const result = await userPlanService.getActiveUserPlan(userId);
      expect(result).toBeNull();
    });

    it('returns active plan when user has one', async () => {
      await userPlanService.createTrialForUser(userId);
      const result = await userPlanService.getActiveUserPlan(userId);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('trial');
      expect(result!.planName).toBe('Trial');
      expect(result!.tokensFromPlan).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createTrialForUser', () => {
    it('creates trial and sets hasUsedTrial', async () => {
      const result = await userPlanService.createTrialForUser(userId);
      expect(result).not.toBeNull();
      expect(result.status).toBe('trial');
      expect(result.planName).toBe('Trial');
      expect(result.tokensFromPlan).toBeGreaterThanOrEqual(0);
      const user = await User.findByPk(userId);
      expect(user!.hasUsedTrial).toBe(true);
    });

    it('throws when user already used trial', async () => {
      await userPlanService.createTrialForUser(userId);
      await expect(userPlanService.createTrialForUser(userId)).rejects.toThrow(
        'Trial already used'
      );
    });

    it('throws when user not found', async () => {
      await expect(
        userPlanService.createTrialForUser('00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('User not found');
    });
  });

  describe('purchasePackage', () => {
    it('creates active user plan for package', async () => {
      const result = await userPlanService.purchasePackage(userId, packagePlanId);
      expect(result).not.toBeNull();
      expect(result.status).toBe('active');
      expect(result.planName).toBe('Pack');
      expect(result.tokensFromPlan).toBe(100);
      expect(result.autoRenew).toBe(false);
    });

    it('throws when plan is not package', async () => {
      await expect(
        userPlanService.purchasePackage(userId, subscriptionPlanId)
      ).rejects.toThrow('not a package');
    });

    it('throws when plan not found', async () => {
      await expect(
        userPlanService.purchasePackage(userId, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Plan not found');
    });
  });

  describe('subscribe', () => {
    it('creates active subscription with autoRenew', async () => {
      const result = await userPlanService.subscribe(userId, subscriptionPlanId);
      expect(result).not.toBeNull();
      expect(result.status).toBe('active');
      expect(result.planName).toBe('Sub');
      expect(result.tokensFromPlan).toBe(200);
      expect(result.autoRenew).toBe(true);
    });

    it('throws when plan is not subscription', async () => {
      await expect(
        userPlanService.subscribe(userId, packagePlanId)
      ).rejects.toThrow('not a subscription');
    });
  });

  describe('cancelSubscription', () => {
    it('sets status to cancelled and autoRenew to false', async () => {
      await userPlanService.subscribe(userId, subscriptionPlanId);
      const result = await userPlanService.cancelSubscription(userId);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('cancelled');
      expect(result!.cancelledAt).not.toBeNull();
    });

    it('returns null when no active plan', async () => {
      const result = await userPlanService.cancelSubscription(userId);
      expect(result).toBeNull();
    });

    it('throws when active plan is not subscription', async () => {
      await userPlanService.purchasePackage(userId, packagePlanId);
      await expect(userPlanService.cancelSubscription(userId)).rejects.toThrow(
        'No active subscription'
      );
    });
  });

  describe('upgrade', () => {
    it('expires current plan and creates new active plan', async () => {
      await userPlanService.purchasePackage(userId, packagePlanId);
      const result = await userPlanService.upgrade(userId, subscriptionPlanId);
      expect(result).not.toBeNull();
      expect(result.status).toBe('active');
      expect(result.planName).toBe('Sub');
      expect(result.tokensFromPlan).toBe(200);
      const previous = await UserPlan.findOne({
        where: { userId, status: 'expired' },
      });
      expect(previous).not.toBeNull();
    });

    it('creates new plan when user had no plan', async () => {
      const result = await userPlanService.upgrade(userId, packagePlanId);
      expect(result).not.toBeNull();
      expect(result.status).toBe('active');
      expect(result.planName).toBe('Pack');
    });

    it('throws when new plan not found', async () => {
      await expect(
        userPlanService.upgrade(userId, '00000000-0000-0000-0000-000000000000')
      ).rejects.toThrow('Plan not found');
    });
  });

  describe('getTokenBalance', () => {
    it('returns zeros when no active plan', async () => {
      const result = await userPlanService.getTokenBalance(userId);
      expect(result.hasActivePlan).toBe(false);
      expect(result.total).toBe(0);
      expect(result.tokensFromPlan).toBe(0);
      expect(result.tokensFromTopup).toBe(0);
    });

    it('returns balance from active plan', async () => {
      await userPlanService.purchasePackage(userId, packagePlanId);
      const result = await userPlanService.getTokenBalance(userId);
      expect(result.hasActivePlan).toBe(true);
      expect(result.tokensFromPlan).toBe(100);
      expect(result.tokensFromTopup).toBe(0);
      expect(result.total).toBe(100);
    });
  });

  describe('consumeTokens', () => {
    it('deducts from tokensFromPlan first', async () => {
      await userPlanService.purchasePackage(userId, packagePlanId);
      const result = await userPlanService.consumeTokens(userId, 30);
      expect(result.remaining).toBe(70);
      const up = await UserPlan.findOne({
        where: { userId, status: 'active' },
      });
      expect(up!.tokensFromPlan).toBe(70);
      expect(up!.tokensFromTopup).toBe(0);
    });

    it('throws when insufficient tokens', async () => {
      await userPlanService.purchasePackage(userId, packagePlanId);
      await expect(userPlanService.consumeTokens(userId, 150)).rejects.toThrow(
        'Insufficient tokens'
      );
    });

    it('throws when no active plan', async () => {
      await expect(userPlanService.consumeTokens(userId, 10)).rejects.toThrow(
        'No active plan'
      );
    });
  });
});
