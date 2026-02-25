import db from '../../shared/config/database';
import { User } from '../../src/user/models/User';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';

beforeAll(async () => {
  await UserPlan.destroy({ where: {} });
  await Plan.destroy({ where: {} });
  await User.destroy({ where: { email: ['planuser@test.com'] } });
});

afterAll(async () => {
  await db.close();
});

describe('UserPlan model', () => {
  let userId: string;
  let planId: string;
  let planSubscriptionId: string;

  beforeAll(async () => {
    const user = await User.create({
      email: 'planuser@test.com',
      username: 'planuser',
      fullname: 'Plan User',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: false,
    });
    userId = user.id;
  });

  beforeEach(async () => {
    await UserPlan.destroy({ where: { userId } });
    const existingPkg = await Plan.findOne({ where: { name: 'Pack', type: 'package' } });
    if (existingPkg) {
      planId = existingPkg.id;
    } else {
      const pkg = await Plan.create({
        name: 'Pack',
        type: 'package',
        tokenAmount: 100,
        periodDays: 30,
        price: 999,
        currency: 'RUB',
      });
      planId = pkg.id;
    }
    const existingSub = await Plan.findOne({ where: { name: 'Sub', type: 'subscription' } });
    if (existingSub) {
      planSubscriptionId = existingSub.id;
    } else {
      const sub = await Plan.create({
        name: 'Sub',
        type: 'subscription',
        tokenAmount: 200,
        periodDays: 30,
        price: 499,
        currency: 'RUB',
      });
      planSubscriptionId = sub.id;
    }
  });

  it('creates user plan with trial status', async () => {
    const start = new Date();
    const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const userPlan = await UserPlan.create({
      userId,
      planId,
      status: 'trial',
      startDate: start,
      endDate: end,
      tokensFromPlan: 50,
      tokensFromTopup: 0,
      autoRenew: false,
    });
    expect(userPlan.id).toBeDefined();
    expect(userPlan.status).toBe('trial');
    expect(userPlan.tokensFromPlan).toBe(50);
    expect(userPlan.tokensFromTopup).toBe(0);
  });

  it('rejects second active plan for same user', async () => {
    const start1 = new Date();
    const end1 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await UserPlan.create({
      userId,
      planId,
      status: 'trial',
      startDate: start1,
      endDate: end1,
      tokensFromPlan: 50,
      tokensFromTopup: 0,
      autoRenew: false,
    });
    const start2 = new Date();
    const end2 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await expect(
      UserPlan.create({
        userId,
        planId: planSubscriptionId,
        status: 'active',
        startDate: start2,
        endDate: end2,
        tokensFromPlan: 200,
        tokensFromTopup: 0,
        autoRenew: true,
      })
    ).rejects.toThrow('User can have only one active plan at a time');
  });

  it('allows expired plan for same user', async () => {
    const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const userPlan = await UserPlan.create({
      userId,
      planId: planSubscriptionId,
      status: 'expired',
      startDate: start,
      endDate: end,
      tokensFromPlan: 0,
      tokensFromTopup: 0,
      autoRenew: false,
    });
    expect(userPlan.status).toBe('expired');
  });

  it('rejects endDate before startDate', async () => {
    const start = new Date();
    const end = new Date(Date.now() - 86400000);
    await expect(
      UserPlan.create({
        userId,
        planId,
        status: 'noplan',
        startDate: start,
        endDate: end,
        tokensFromPlan: 0,
        tokensFromTopup: 0,
        autoRenew: false,
      })
    ).rejects.toThrow('endDate must be >= startDate');
  });

  it('rejects negative tokensFromPlan', async () => {
    const start = new Date();
    const end = new Date(Date.now() + 86400000);
    await expect(
      UserPlan.create({
        userId,
        planId,
        status: 'noplan',
        startDate: start,
        endDate: end,
        tokensFromPlan: -1,
        tokensFromTopup: 0,
        autoRenew: false,
      })
    ).rejects.toThrow();
  });

  it('allows update to active when no other active plan', async () => {
    const firstTrial = await UserPlan.findOne({ where: { status: 'trial', userId } });
    if (firstTrial) {
      await firstTrial.update({ status: 'expired' });
    }
    const start = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const end = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expiredPlan = await UserPlan.create({
      userId,
      planId: planSubscriptionId,
      status: 'expired',
      startDate: start,
      endDate: end,
      tokensFromPlan: 0,
      tokensFromTopup: 0,
      autoRenew: false,
    });
    await expiredPlan.update({ status: 'active' });
    const updated = await UserPlan.findByPk(expiredPlan.id);
    expect(updated!.status).toBe('active');
  });
});
