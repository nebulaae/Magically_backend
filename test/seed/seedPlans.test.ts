import db from '../../shared/config/database';
import { Plan } from '../../src/plans/models/Plan';
import { seedPlans } from '../../shared/scripts/seedPlans';
import { Op } from 'sequelize';

beforeAll(async () => {
  await Plan.destroy({ where: {} });
});

beforeEach(async () => {
  await Plan.destroy({ where: {} });
});

afterAll(async () => {
  await db.close();
});

describe('seedPlans', () => {
  it('creates default plans on first run', async () => {
    await seedPlans();
    const expectedNames = [
      'Starter Pack',
      'Monthly Pack',
      'Quarter Pack',
      'Starter',
      'Pro',
      'Business',
      'Top-up 100',
      'Top-up 500',
      'Top-up 1000',
    ];
    const allPlans = await Plan.findAll({ attributes: ['name', 'type'] });
    const planNames = new Set(allPlans.map((p) => p.name));
    for (const name of expectedNames) {
      expect(planNames.has(name)).toBe(true);
    }
    const packageNames = expectedNames.slice(0, 3);
    const subscriptionNames = expectedNames.slice(3, 6);
    const topupNames = expectedNames.slice(6);
    const packages = allPlans.filter((p) => p.type === 'package' && packageNames.includes(p.name)).length;
    const subscriptions = allPlans.filter((p) => p.type === 'subscription' && subscriptionNames.includes(p.name)).length;
    const topups = allPlans.filter((p) => p.type === 'topup' && topupNames.includes(p.name)).length;
    expect(packages).toBe(3);
    expect(subscriptions).toBe(3);
    expect(topups).toBe(3);
  });

  it('does not duplicate plans on second run', async () => {
    await seedPlans();
    const namesBefore = await Plan.findAll({ attributes: ['name'] }).then((rows) =>
      new Set(rows.map((r) => r.name))
    );
    await seedPlans();
    const namesAfter = await Plan.findAll({ attributes: ['name'] }).then((rows) =>
      new Set(rows.map((r) => r.name))
    );
    expect(namesAfter.size).toBeGreaterThanOrEqual(namesBefore.size);
    const expectedNames = [
      'Starter Pack',
      'Monthly Pack',
      'Quarter Pack',
      'Starter',
      'Pro',
      'Business',
      'Top-up 100',
      'Top-up 500',
      'Top-up 1000',
    ];
    for (const name of expectedNames) {
      expect(namesAfter.has(name)).toBe(true);
    }
  });

  it('creates plans with expected names', async () => {
    await seedPlans();
    const expectedNames = [
      'Starter Pack',
      'Monthly Pack',
      'Quarter Pack',
      'Starter',
      'Pro',
      'Business',
      'Top-up 100',
      'Top-up 500',
      'Top-up 1000',
    ];
    const names = await Plan.findAll({ attributes: ['name'], order: [['name', 'ASC']] }).then((rows) =>
      rows.map((r) => r.name)
    );
    for (const name of expectedNames) {
      expect(names).toContain(name);
    }
  });
});
