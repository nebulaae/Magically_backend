import db from '../config/database';
import { Plan } from '../../src/plans/models/Plan';
import { setupAssociations } from '../models/associations';
import logger from '../utils/logger';

const DEFAULT_PLANS = [
  { name: 'Starter Pack', description: '7 days', type: 'package' as const, tokenAmount: 100, periodDays: 7, price: 299, currency: 'RUB' },
  { name: 'Monthly Pack', description: '30 days', type: 'package' as const, tokenAmount: 500, periodDays: 30, price: 999, currency: 'RUB' },
  { name: 'Quarter Pack', description: '90 days', type: 'package' as const, tokenAmount: 1500, periodDays: 90, price: 2499, currency: 'RUB' },
  { name: 'Starter', description: 'Monthly subscription', type: 'subscription' as const, tokenAmount: 200, periodDays: 30, price: 499, currency: 'RUB' },
  { name: 'Pro', description: 'Monthly subscription', type: 'subscription' as const, tokenAmount: 600, periodDays: 30, price: 1299, currency: 'RUB' },
  { name: 'Business', description: 'Monthly subscription', type: 'subscription' as const, tokenAmount: 1500, periodDays: 30, price: 2999, currency: 'RUB' },
  { name: 'Top-up 100', description: '100 tokens', type: 'topup' as const, tokenAmount: 100, periodDays: null, price: 99, currency: 'RUB' },
  { name: 'Top-up 500', description: '500 tokens', type: 'topup' as const, tokenAmount: 500, periodDays: null, price: 399, currency: 'RUB' },
  { name: 'Top-up 1000', description: '1000 tokens', type: 'topup' as const, tokenAmount: 1000, periodDays: null, price: 699, currency: 'RUB' },
];

export const seedPlans = async () => {
  try {
    await db.authenticate();
    if (require.main === module) {
      setupAssociations();
    }
    let createdCount = 0;
    for (const row of DEFAULT_PLANS) {
      const [plan, created] = await Plan.findOrCreate({
        where: { name: row.name },
        defaults: {
          name: row.name,
          description: row.description,
          type: row.type,
          tokenAmount: row.tokenAmount,
          periodDays: row.periodDays ?? null,
          price: row.price,
          currency: row.currency,
          isActive: true,
        },
      });
      if (created) {
        logger.info(`Created plan: ${row.name}`);
        createdCount++;
      }
    }
    if (createdCount === 0) {
      logger.info('Plans already seeded, skipping.');
    } else {
      logger.info(`Plans seed completed. Created ${createdCount} plans.`);
    }
  } catch (error) {
    logger.error(`Plans seed failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
};

if (require.main === module) {
  seedPlans()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
