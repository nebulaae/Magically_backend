import { Op } from 'sequelize';
import db from '../config/database';
import { Plan } from '../../src/plans/models/Plan';
import { UserPlan } from '../../src/plans/models/UserPlan';
import { TopUp } from '../../src/plans/models/TopUp';
import { setupAssociations } from '../models/associations';
import logger from '../utils/logger';

const REMOVE_PLAN_NAMES = ['Test BYN', 'Pack RUB'];

const LEGACY_PLAN_NAMES = [
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

const SEED_PLAN_NAMES = [
  'Trial',
  'Фея',
  'Чародей',
  'Волшебник',
  'Фея (год)',
  'Чародей (год)',
  'Волшебник (год)',
  'Energy 3000',
];

const DEFAULT_PLANS = [
  {
    name: 'Trial',
    description: 'Trial period',
    type: 'package' as const,
    tokenAmount: 50,
    periodDays: 7,
    price: 0,
    currency: 'RUB',
  },

  {
    name: 'Фея',
    description: 'Месячный пакет',
    type: 'package' as const,
    tokenAmount: 495,
    periodDays: 30,
    price: 499,
    currency: 'RUB',
  },
  {
    name: 'Чародей',
    description: 'Месячный пакет',
    type: 'package' as const,
    tokenAmount: 1095,
    periodDays: 30,
    price: 999,
    currency: 'RUB',
  },
  {
    name: 'Волшебник',
    description: 'Месячный пакет',
    type: 'package' as const,
    tokenAmount: 2745,
    periodDays: 30,
    price: 2499,
    currency: 'RUB',
  },
  {
    name: 'Фея (год)',
    description: 'Годовой пакет',
    type: 'package' as const,
    tokenAmount: 5940,
    periodDays: 365,
    price: 4990,
    currency: 'RUB',
  },
  {
    name: 'Чародей (год)',
    description: 'Годовой пакет',
    type: 'package' as const,
    tokenAmount: 13140,
    periodDays: 365,
    price: 9990,
    currency: 'RUB',
  },
  {
    name: 'Волшебник (год)',
    description: 'Годовой пакет',
    type: 'package' as const,
    tokenAmount: 32940,
    periodDays: 365,
    price: 24990,
    currency: 'RUB',
  },
  {
    name: 'Energy 3000',
    description: 'Пополнение энергии (база 3000, шаг 100)',
    type: 'topup' as const,
    tokenAmount: 3000,
    periodDays: null,
    price: 2500,
    currency: 'RUB',
  },
];

export const seedPlans = async () => {
  try {
    await db.authenticate();
    if (require.main === module) {
      setupAssociations();
    }
    const plansToRemove = await Plan.findAll({
      where: { name: { [Op.in]: REMOVE_PLAN_NAMES } },
      attributes: ['id'],
    });
    if (plansToRemove.length > 0) {
      const planIds = plansToRemove.map((p) => p.id);
      const userPlans = await UserPlan.findAll({
        where: { planId: { [Op.in]: planIds } },
        attributes: ['id'],
      });
      const userPlanIds = userPlans.map((up) => up.id);
      if (userPlanIds.length > 0) {
        await TopUp.destroy({ where: { userPlanId: { [Op.in]: userPlanIds } } });
      }
      await UserPlan.destroy({ where: { planId: { [Op.in]: planIds } } });
      await Plan.destroy({ where: { id: { [Op.in]: planIds } } });
      logger.info(`Removed ${plansToRemove.length} test plan(s): ${REMOVE_PLAN_NAMES.join(', ')}`);
    }
    const [deactivated] = await Plan.update(
      { isActive: false },
      { where: { name: { [Op.in]: LEGACY_PLAN_NAMES } } }
    );
    if (deactivated > 0) {
      logger.info(`Deactivated ${deactivated} legacy plan(s).`);
    }
    const existingSeedPlans = await Plan.findAll({
      where: { name: { [Op.in]: SEED_PLAN_NAMES } },
      attributes: ['id'],
    });
    if (existingSeedPlans.length > 0) {
      const ids = existingSeedPlans.map((p) => p.id);
      const userPlansForSeed = await UserPlan.findAll({
        where: { planId: { [Op.in]: ids } },
        attributes: ['id'],
      });
      const upIds = userPlansForSeed.map((up) => up.id);
      if (upIds.length > 0) {
        await TopUp.destroy({ where: { userPlanId: { [Op.in]: upIds } } });
      }
      await UserPlan.destroy({ where: { planId: { [Op.in]: ids } } });
      await Plan.destroy({ where: { id: { [Op.in]: ids } } });
      logger.info(`Removed ${existingSeedPlans.length} seed plan(s) for re-seed.`);
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
    logger.error(
      `Plans seed failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw error;
  }
};

if (require.main === module) {
  seedPlans()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
