import db from '../../shared/config/database';
import { User } from '../../src/user/models/User';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';
import { TopUp } from '../../src/plans/models/TopUp';

beforeAll(async () => {
  await TopUp.destroy({ where: {} });
  await UserPlan.destroy({ where: {} });
  await Plan.destroy({ where: {} });
  await User.destroy({ where: { email: ['topupuser@test.com'] } });
});

afterAll(async () => {
  await db.close();
});

describe('TopUp model', () => {
  let userId: string;
  let userPlanId: string;

  beforeAll(async () => {
    const user = await User.create({
      email: 'topupuser@test.com',
      username: 'topupuser',
      fullname: 'TopUp User',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: true,
    });
    userId = user.id;
    const plan = await Plan.create({
      name: 'Pack',
      type: 'package',
      tokenAmount: 100,
      periodDays: 30,
      price: 999,
      currency: 'RUB',
    });
    const start = new Date();
    const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const userPlan = await UserPlan.create({
      userId,
      planId: plan.id,
      status: 'active',
      startDate: start,
      endDate: end,
      tokensFromPlan: 50,
      tokensFromTopup: 0,
      autoRenew: false,
    });
    userPlanId = userPlan.id;
  });

  it('creates topup with required fields', async () => {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const topup = await TopUp.create({
      userId,
      userPlanId,
      tokenAmount: 100,
      price: 99,
      currency: 'RUB',
      expiresAt,
    });
    expect(topup.id).toBeDefined();
    expect(topup.tokenAmount).toBe(100);
    expect(Number(topup.price)).toBe(99);
    expect(topup.expiresAt).toEqual(expiresAt);
    expect(topup.createdAt).toBeDefined();
    expect((topup as { updatedAt?: Date }).updatedAt).toBeUndefined();
  });

  it('rejects tokenAmount zero', async () => {
    const expiresAt = new Date(Date.now() + 86400000);
    await expect(
      TopUp.create({
        userId,
        userPlanId,
        tokenAmount: 0,
        price: 0,
        currency: 'RUB',
        expiresAt,
      })
    ).rejects.toThrow();
  });

  it('rejects negative tokenAmount', async () => {
    const expiresAt = new Date(Date.now() + 86400000);
    await expect(
      TopUp.create({
        userId,
        userPlanId,
        tokenAmount: -1,
        price: 0,
        currency: 'RUB',
        expiresAt,
      })
    ).rejects.toThrow();
  });

  it('rejects negative price', async () => {
    const expiresAt = new Date(Date.now() + 86400000);
    await expect(
      TopUp.create({
        userId,
        userPlanId,
        tokenAmount: 100,
        price: -1,
        currency: 'RUB',
        expiresAt,
      })
    ).rejects.toThrow();
  });
});
