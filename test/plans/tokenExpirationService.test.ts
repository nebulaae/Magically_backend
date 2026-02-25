import db from '../../shared/config/database';
import { User } from '../../src/user/models/User';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';
import * as userPlanService from '../../src/plans/service/userPlanService';
import * as tokenExpirationService from '../../src/plans/service/tokenExpirationService';

jest.mock('../../src/admin/service/settingService', () => ({
  getSettings: jest.fn().mockResolvedValue({
    trialTokens: 50,
    trialPeriodDays: 7,
  }),
}));

const TEST_EMAIL = 'token-expiration@test.com';

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

describe('TokenExpirationService', () => {
  let userId: string;
  let packagePlanId: string;
  let subscriptionPlanId: string;

  beforeEach(async () => {
    const user = await User.create({
      email: TEST_EMAIL,
      username: 'tokenexp',
      fullname: 'Token Expiration Test',
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

  it('expires trial to noplan and burns tokens', async () => {
    const now = new Date('2026-02-01T12:00:00Z');
    const dto = await userPlanService.createTrialForUser(userId);
    const up = await UserPlan.findByPk(dto.id);
    const pastStart = new Date('2026-01-01T00:00:00Z');
    const pastEnd = new Date('2026-01-25T00:00:00Z');
    await up!.update({
      startDate: pastStart,
      endDate: pastEnd,
      tokensFromPlan: 30,
      tokensFromTopup: 0,
    });

    await tokenExpirationService.processExpirations(now);

    const updated = await UserPlan.findByPk(dto.id);
    expect(updated!.status).toBe('noplan');
    expect(updated!.tokensFromPlan).toBe(0);
    expect(updated!.tokensFromTopup).toBe(0);
  });

  it('expires package to expired and burns tokens', async () => {
    const now = new Date('2026-02-15T12:00:00Z');
    const dto = await userPlanService.purchasePackage(userId, packagePlanId);
    const up = await UserPlan.findByPk(dto.id);
    const pastStart = new Date('2026-01-01T00:00:00Z');
    const pastEnd = new Date('2026-02-01T00:00:00Z');
    await up!.update({
      startDate: pastStart,
      endDate: pastEnd,
      tokensFromPlan: 40,
      tokensFromTopup: 10,
    });

    await tokenExpirationService.processExpirations(now);

    const updated = await UserPlan.findByPk(dto.id);
    expect(updated!.status).toBe('expired');
    expect(updated!.tokensFromPlan).toBe(0);
    expect(updated!.tokensFromTopup).toBe(0);
  });

  it('expires cancelled subscription after endDate and burns tokens', async () => {
    const now = new Date('2026-02-20T12:00:00Z');
    const dto = await userPlanService.subscribe(userId, subscriptionPlanId);
    await userPlanService.cancelSubscription(userId);
    const up = await UserPlan.findByPk(dto.id);
    const pastStart = new Date('2026-01-15T00:00:00Z');
    const pastEnd = new Date('2026-02-10T00:00:00Z');
    await up!.update({
      startDate: pastStart,
      endDate: pastEnd,
      tokensFromPlan: 100,
      tokensFromTopup: 20,
    });

    await tokenExpirationService.processExpirations(now);

    const updated = await UserPlan.findByPk(dto.id);
    expect(updated!.status).toBe('expired');
    expect(updated!.tokensFromPlan).toBe(0);
    expect(updated!.tokensFromTopup).toBe(0);
  });

  it('does not expire trial when endDate is in future', async () => {
    const now = new Date('2026-01-05T12:00:00Z');
    const dto = await userPlanService.createTrialForUser(userId);
    const up = await UserPlan.findByPk(dto.id);
    const trialStart = new Date('2026-01-01T00:00:00Z');
    const trialEnd = new Date('2026-01-10T00:00:00Z');
    await up!.update({
      startDate: trialStart,
      endDate: trialEnd,
      tokensFromPlan: 25,
    });

    await tokenExpirationService.processExpirations(now);

    const updated = await UserPlan.findByPk(dto.id);
    expect(updated!.status).toBe('trial');
    expect(updated!.tokensFromPlan).toBe(25);
  });

  it('does not expire active subscription with autoRenew when endDate passed', async () => {
    const now = new Date('2026-02-15T12:00:00Z');
    const dto = await userPlanService.subscribe(userId, subscriptionPlanId);
    const up = await UserPlan.findByPk(dto.id);
    const pastStart = new Date('2026-01-01T00:00:00Z');
    const pastEnd = new Date('2026-02-01T00:00:00Z');
    await up!.update({
      startDate: pastStart,
      endDate: pastEnd,
      tokensFromPlan: 50,
      autoRenew: true,
    });

    await tokenExpirationService.processExpirations(now);

    const updated = await UserPlan.findByPk(dto.id);
    expect(updated!.status).toBe('active');
    expect(updated!.tokensFromPlan).toBe(50);
  });
});
