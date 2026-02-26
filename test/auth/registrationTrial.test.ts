import db from '../../shared/config/database';
import { User } from '../../src/user/models/User';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';
import * as authService from '../../src/auth/service/authService';

jest.mock('../../src/admin/service/settingService', () => ({
  getSettings: jest
    .fn()
    .mockResolvedValue({ trialTokens: 50, trialPeriodDays: 7 }),
}));

const TEST_EMAIL = 'registration-trial@test.com';

beforeAll(async () => {
  const existing = await User.findOne({ where: { email: TEST_EMAIL } });
  if (existing) {
    await UserPlan.destroy({ where: { userId: existing.id } });
    await existing.destroy();
  }
  let trial = await Plan.findOne({ where: { name: 'Trial' } });
  if (!trial) {
    await Plan.create({
      name: 'Trial',
      type: 'package',
      tokenAmount: 50,
      periodDays: 7,
      price: 0,
      currency: 'RUB',
      isActive: true,
    });
  }
});

afterAll(async () => {
  await db.close();
});

describe('Registration creates trial', () => {
  it('creates trial when user completes registerStep3 and has not used trial', async () => {
    const user = await User.create({
      email: TEST_EMAIL,
      username: 'regtrial',
      fullname: 'Reg Trial',
      password: 'hash',
      tokens: 0,
      dailyActions: { count: 0, lastReset: new Date() },
      role: 'user',
      isBlocked: false,
      verified: true,
      hasUsedTrial: false,
    });

    await authService.registerStep3(
      TEST_EMAIL,
      'Full Name',
      'regtrial',
      'newpass'
    );

    const plan = await UserPlan.findOne({
      where: { userId: user.id },
      order: [['createdAt', 'DESC']],
    });
    expect(plan).not.toBeNull();
    expect(plan!.status).toBe('trial');
    const refreshed = await User.findByPk(user.id);
    expect(refreshed!.hasUsedTrial).toBe(true);
  });
});
