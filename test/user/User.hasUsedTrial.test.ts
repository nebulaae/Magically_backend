import db from '../../shared/config/database';
import { User } from '../../src/user/models/User';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';
import { TopUp } from '../../src/plans/models/TopUp';

type UserWithPlans = User & { userPlans?: (UserPlan & { plan?: Plan })[] };
type UserPlanWithTopUps = UserPlan & { topUps?: TopUp[] };

beforeAll(async () => {
  await TopUp.destroy({ where: {} });
  await UserPlan.destroy({ where: {} });
  await Plan.destroy({ where: {} });
  await User.destroy({
    where: {
      email: ['trialcheck@test.com', 'trialused@test.com', 'assoc@test.com', 'topupassoc@test.com'],
    },
  });
});

afterAll(async () => {
  await db.close();
});

describe('User hasUsedTrial', () => {
  it('defaults hasUsedTrial to false on create', async () => {
    const user = await User.create({
      email: 'trialcheck@test.com',
      username: 'trialcheck',
      fullname: 'Trial Check',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
    });
    expect(user.hasUsedTrial).toBe(false);
  });

  it('persists hasUsedTrial when set to true', async () => {
    const user = await User.create({
      email: 'trialused@test.com',
      username: 'trialused',
      fullname: 'Trial Used',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: true,
    });
    expect(user.hasUsedTrial).toBe(true);
    const found = await User.findByPk(user.id);
    expect(found!.hasUsedTrial).toBe(true);
  });
});

describe('Plans associations', () => {
  it('User hasMany UserPlan and UserPlan belongsTo Plan', async () => {
    const user = await User.create({
      email: 'assoc@test.com',
      username: 'assocuser',
      fullname: 'Assoc User',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: false,
    });
    const plan = await Plan.create({
      name: 'Assoc Plan',
      type: 'package',
      tokenAmount: 50,
      periodDays: 7,
      price: 199,
      currency: 'RUB',
    });
    const start = new Date();
    const end = new Date(Date.now() + 7 * 86400000);
    const userPlan = await UserPlan.create({
      userId: user.id,
      planId: plan.id,
      status: 'trial',
      startDate: start,
      endDate: end,
      tokensFromPlan: 50,
      tokensFromTopup: 0,
      autoRenew: false,
    });
    const userWithPlans = (await User.findByPk(user.id, {
      include: [{ association: 'userPlans', include: [{ association: 'plan' }] }],
    })) as UserWithPlans | null;
    expect(userWithPlans!.userPlans).toHaveLength(1);
    expect(userWithPlans!.userPlans![0].plan!.name).toBe('Assoc Plan');
    expect(userWithPlans!.userPlans![0].id).toBe(userPlan.id);
  });

  it('UserPlan hasMany TopUp and TopUp belongsTo UserPlan', async () => {
    const user = await User.create({
      email: 'topupassoc@test.com',
      username: 'topupassoc',
      fullname: 'TopUp Assoc',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: true,
    });
    const plan = await Plan.create({
      name: 'P',
      type: 'package',
      tokenAmount: 100,
      periodDays: 30,
      price: 999,
      currency: 'RUB',
    });
    const start = new Date();
    const end = new Date(Date.now() + 30 * 86400000);
    const userPlan = await UserPlan.create({
      userId: user.id,
      planId: plan.id,
      status: 'active',
      startDate: start,
      endDate: end,
      tokensFromPlan: 100,
      tokensFromTopup: 0,
      autoRenew: false,
    });
    const expiresAt = new Date(Date.now() + 30 * 86400000);
    await TopUp.create({
      userId: user.id,
      userPlanId: userPlan.id,
      tokenAmount: 50,
      price: 49,
      currency: 'RUB',
      expiresAt,
    });
    const up = (await UserPlan.findByPk(userPlan.id, {
      include: [{ association: 'topUps' }],
    })) as UserPlanWithTopUps | null;
    expect(up!.topUps).toHaveLength(1);
    expect(up!.topUps![0].tokenAmount).toBe(50);
  });
});
