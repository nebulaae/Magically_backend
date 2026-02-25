import logger from '../utils/logger';
import * as subscriptionRenewalService from '../../src/plans/service/subscriptionRenewalService';
import * as tokenExpirationService from '../../src/plans/service/tokenExpirationService';

export const runSubscriptionRenewalsJob = async () => {
  try {
    await subscriptionRenewalService.processRenewals(new Date());
    logger.info('Subscription renewals job completed');
  } catch (error: unknown) {
    logger.error(
      `Subscription renewals job failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export const runGracePeriodJob = async () => {
  try {
    await subscriptionRenewalService.processGraceExpirations(new Date());
    logger.info('Subscription grace-period job completed');
  } catch (error: unknown) {
    logger.error(
      `Subscription grace-period job failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export const runTokenExpirationJob = async () => {
  try {
    await tokenExpirationService.processExpirations(new Date());
    logger.info('Token expiration job completed');
  } catch (error: unknown) {
    logger.error(
      `Token expiration job failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};
