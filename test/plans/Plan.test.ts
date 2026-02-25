import db from '../../shared/config/database';
import { Plan } from '../../src/plans/models/Plan';

beforeAll(async () => {
  await Plan.destroy({ where: {} });
});

afterAll(async () => {
  await db.close();
});

describe('Plan model', () => {
  it('creates package plan with required fields', async () => {
    const plan = await Plan.create({
      name: 'Starter Pack',
      description: '7 days',
      type: 'package',
      tokenAmount: 100,
      periodDays: 7,
      price: 299,
      currency: 'RUB',
      isActive: true,
    });
    expect(plan.id).toBeDefined();
    expect(plan.name).toBe('Starter Pack');
    expect(plan.type).toBe('package');
    expect(plan.tokenAmount).toBe(100);
    expect(plan.periodDays).toBe(7);
    expect(Number(plan.price)).toBe(299);
    expect(plan.isActive).toBe(true);
    expect(plan.createdAt).toBeDefined();
    expect(plan.updatedAt).toBeDefined();
  });

  it('creates subscription plan', async () => {
    const plan = await Plan.create({
      name: 'Pro',
      type: 'subscription',
      tokenAmount: 600,
      periodDays: 30,
      price: 1299,
      currency: 'RUB',
    });
    expect(plan.type).toBe('subscription');
    expect(plan.periodDays).toBe(30);
  });

  it('creates topup plan with null periodDays', async () => {
    const plan = await Plan.create({
      name: 'Top-up 100',
      type: 'topup',
      tokenAmount: 100,
      periodDays: null,
      price: 99,
      currency: 'RUB',
    });
    expect(plan.type).toBe('topup');
    expect(plan.periodDays).toBeNull();
  });

  it('rejects package with missing periodDays', async () => {
    await expect(
      Plan.create({
        name: 'Bad Pack',
        type: 'package',
        tokenAmount: 100,
        periodDays: null,
        price: 299,
        currency: 'RUB',
      })
    ).rejects.toThrow('periodDays must be positive');
  });

  it('rejects package with zero periodDays', async () => {
    await expect(
      Plan.create({
        name: 'Bad Pack',
        type: 'package',
        tokenAmount: 100,
        periodDays: 0,
        price: 299,
        currency: 'RUB',
      })
    ).rejects.toThrow('periodDays must be positive');
  });

  it('rejects subscription with negative periodDays', async () => {
    await expect(
      Plan.create({
        name: 'Bad Sub',
        type: 'subscription',
        tokenAmount: 200,
        periodDays: -1,
        price: 499,
        currency: 'RUB',
      })
    ).rejects.toThrow('periodDays must be positive');
  });

  it('rejects negative tokenAmount', async () => {
    await expect(
      Plan.create({
        name: 'Bad',
        type: 'topup',
        tokenAmount: -1,
        periodDays: null,
        price: 0,
        currency: 'RUB',
      })
    ).rejects.toThrow();
  });

  it('rejects negative price', async () => {
    await expect(
      Plan.create({
        name: 'Bad',
        type: 'topup',
        tokenAmount: 100,
        periodDays: null,
        price: -1,
        currency: 'RUB',
      })
    ).rejects.toThrow();
  });
});
