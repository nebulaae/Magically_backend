import db from '../../shared/config/database';
import * as paymentService from '../../src/payment/service/paymentService';
import * as subscriptionRenewalService from '../../src/plans/service/subscriptionRenewalService';
import * as paymentRepository from '../../src/payment/repository/paymentRepository';

jest.mock('../../src/plans/service/subscriptionRenewalService', () => ({
  fulfillRecurringSuccess: jest.fn().mockResolvedValue(undefined),
  fulfillRecurringFailure: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/payment/repository/paymentRepository');

const mockPayment = (metadata: Record<string, unknown>) => ({
  id: 'pay-1',
  userId: 'user-1',
  status: 'pending' as const,
  metadata,
});

describe('Recurring payment webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(db, 'transaction').mockImplementation(((fn: (t: unknown) => Promise<unknown>) => fn({})) as any);
    (paymentRepository.updatePayment as jest.Mock).mockResolvedValue({ id: 'pay-1', status: 'completed' });
  });

  it('calls fulfillRecurringSuccess on successful recurring payment', async () => {
    const payment = mockPayment({ planOperation: 'subscription_renewal', userPlanId: 'up-1' });
    (paymentRepository.findPaymentById as jest.Mock).mockResolvedValue(payment);

    const webhookData = {
      transaction: {
        tracking_id: 'pay-1',
        status: 'successful',
        amount: 49900,
        currency: 'RUB',
      },
    };

    const result = await paymentService.handleBePaidWebhook(webhookData as any);

    expect(result.success).toBe(true);
    expect(subscriptionRenewalService.fulfillRecurringSuccess).toHaveBeenCalledWith('up-1');
    expect(subscriptionRenewalService.fulfillRecurringFailure).not.toHaveBeenCalled();
  });

  it('calls fulfillRecurringFailure on failed recurring payment', async () => {
    const payment = mockPayment({ planOperation: 'subscription_renewal', userPlanId: 'up-2' });
    (paymentRepository.findPaymentById as jest.Mock).mockResolvedValue(payment);

    const webhookData = {
      transaction: {
        tracking_id: 'pay-1',
        status: 'failed',
        amount: 49900,
        currency: 'RUB',
      },
    };

    const result = await paymentService.handleBePaidWebhook(webhookData as any);

    expect(result.success).toBe(true);
    expect(subscriptionRenewalService.fulfillRecurringFailure).toHaveBeenCalledWith('up-2');
    expect(subscriptionRenewalService.fulfillRecurringSuccess).not.toHaveBeenCalled();
  });

  it('calls fulfillRecurringFailure on expired recurring payment', async () => {
    const payment = mockPayment({ planOperation: 'subscription_renewal', userPlanId: 'up-3' });
    (paymentRepository.findPaymentById as jest.Mock).mockResolvedValue(payment);

    const webhookData = {
      transaction: {
        tracking_id: 'pay-1',
        status: 'expired',
        amount: 49900,
        currency: 'RUB',
      },
    };

    const result = await paymentService.handleBePaidWebhook(webhookData as any);

    expect(result.success).toBe(true);
    expect(subscriptionRenewalService.fulfillRecurringFailure).toHaveBeenCalledWith('up-3');
    expect(subscriptionRenewalService.fulfillRecurringSuccess).not.toHaveBeenCalled();
  });
});
