import db from '../../shared/config/database';
import { User } from '../../src/user/models/User';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';
import * as userPlanService from '../../src/plans/service/userPlanService';
import * as subscriptionRenewalService from '../../src/plans/service/subscriptionRenewalService';

jest.mock('../../src/admin/service/settingService', () => ({
  getSettings: jest.fn().mockResolvedValue({
    trialTokens: 50,
    trialPeriodDays: 7,
    subscriptionGracePeriodDays: 5,
  }),
}));

const TEST_EMAIL = 'subscription-renewal@test.com';

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

describe('SubscriptionRenewalService', () => {
  let userId: string;
  let subscriptionPlanId: string;

  beforeEach(async () => {
    const user = await User.create({
      email: TEST_EMAIL,
      username: 'subsrenew',
      fullname: 'Subscription Renewal Test',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: false,
    });
    userId = user.id;

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

  it('renews subscription on successful charge', async () => {
    const now = new Date('2026-01-10T00:00:00Z');
    const dto = await userPlanService.subscribe(userId, subscriptionPlanId);
    const up = await UserPlan.findByPk(dto.id);
    await up!.update({
      startDate: new Date('2025-12-01T00:00:00Z'),
      endDate: new Date('2026-01-01T00:00:00Z'),
      tokensFromPlan: 50,
      tokensFromTopup: 20,
    });

    subscriptionRenewalService.setChargeFn(async () => 'success');

    await subscriptionRenewalService.processRenewals(now);

    const updated = await UserPlan.findByPk(dto.id);
    expect(updated!.status).toBe('active');
    expect(updated!.tokensFromPlan).toBe(200);
    expect(updated!.tokensFromTopup).toBe(0);
    expect(updated!.gracePeriodEnd).toBeNull();
    expect(updated!.startDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
    const expectedEnd = new Date(now);
    expectedEnd.setDate(expectedEnd.getDate() + 30);
    expect(updated!.endDate.getDate()).toBe(expectedEnd.getDate());
  });

  it('marks subscription as overdue on failed charge', async () => {
    const now = new Date('2026-01-10T00:00:00Z');
    const dto = await userPlanService.subscribe(userId, subscriptionPlanId);
    const up = await UserPlan.findByPk(dto.id);
    await up!.update({
      startDate: new Date('2025-12-01T00:00:00Z'),
      endDate: new Date('2026-01-01T00:00:00Z'),
      tokensFromPlan: 150,
      tokensFromTopup: 10,
    });

    subscriptionRenewalService.setChargeFn(async () => 'failed');

    await subscriptionRenewalService.processRenewals(now);

    const updated = await UserPlan.findByPk(dto.id);
    expect(updated!.status).toBe('overdue');
    expect(updated!.tokensFromPlan).toBe(150);
    expect(updated!.tokensFromTopup).toBe(10);
    expect(updated!.gracePeriodEnd).not.toBeNull();
  });

  it('expires overdue subscription after grace period', async () => {
    const now = new Date('2026-01-20T00:00:00Z');
    const dto = await userPlanService.subscribe(userId, subscriptionPlanId);
    const up = await UserPlan.findByPk(dto.id);
    await up!.update({
      status: 'overdue',
      gracePeriodEnd: new Date('2026-01-15T00:00:00Z'),
      tokensFromPlan: 100,
      tokensFromTopup: 50,
    });

    await subscriptionRenewalService.processGraceExpirations(now);

    const updated = await UserPlan.findByPk(dto.id);
    expect(updated!.status).toBe('expired');
    expect(updated!.tokensFromPlan).toBe(0);
    expect(updated!.tokensFromTopup).toBe(0);
    expect(updated!.autoRenew).toBe(false);
    expect(updated!.gracePeriodEnd).toBeNull();
  });
});

