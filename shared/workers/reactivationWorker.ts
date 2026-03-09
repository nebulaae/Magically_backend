import logger from '../utils/logger';
import { Op } from 'sequelize';
import { User } from '../../src/user/models/User';
import { EmailLog } from '../../src/notification/models/EmailLog';
import { getActiveUserPlan } from '../../src/plans/service/userPlanService';
import { sendReactivationEmail, isTelegramEmail } from '../scripts/email';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const startReactivationWorker = () => {
  logger.info('Reactivation worker started.');
  setInterval(() => {
    void runReactivationJob();
  }, ONE_DAY_MS);
};

export const runReactivationJob = async () => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * ONE_DAY_MS);

  try {
    const candidates = await User.findAll({
      where: {
        createdAt: {
          [Op.lt]: cutoff,
        },
        isBlocked: false,
        role: 'user',
      },
      limit: 500,
    });

    logger.info(
      `Reactivation worker: found ${candidates.length} candidate users`
    );

    for (const user of candidates) {
      try {
        if (!user.email || isTelegramEmail(user.email)) {
          continue;
        }

        const existingLog = await EmailLog.findOne({
          where: {
            userId: user.id,
            type: 'reactivation',
          },
        });

        if (existingLog) {
          continue;
        }

        const activePlan = await getActiveUserPlan(user.id);
        if (activePlan) {
          continue;
        }

        const hasSuccessfulPayment = 0;

        if (hasSuccessfulPayment > 0) {
          continue;
        }

        const tariffsUrl =
          process.env.FRONTEND_URL?.concat('/tariffs');

        await sendReactivationEmail(user.email, {
          userId: user.id,
          tariffsUrl,
        });

        logger.info(
          `Reactivation email sent to user ${user.id} (${user.email})`
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(
          `Reactivation worker: failed for user ${user.id}: ${msg}`
        );
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Reactivation worker failed: ${msg}`);
  }
};

