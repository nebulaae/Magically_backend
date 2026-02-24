import logger from '../../../shared/utils/logger';
import * as paymentRepository from '../repository/paymentRepository';
import { Payment } from '../models/Payment';
import * as bePaidService from './bePaidService';
import { performTransaction } from '../../transaction/service/transactionService';
import { calculateTokensFromPayment } from './currencyConversionService';
import * as userPlanService from '../../plans/service/userPlanService';
import * as topUpService from '../../plans/service/topUpService';
import db from '../../../shared/config/database';
import { findPaymentById } from '../repository/paymentRepository';

// Создает новый платеж
export const createPayment = async (paymentData: {
  userId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  paymentProvider?: 'bepaid';
  description?: string;
  metadata?: Record<string, any>;
}) => {
  const payment = await paymentRepository.createPayment({
    ...paymentData,
    currency: paymentData.currency || 'RUB',
    status: 'pending',
  } as Partial<Payment>);
  logger.info(`Payment created: ${payment.id} for user ${paymentData.userId}`);
  return payment;
};

// Обновляет статус платежа
export const updatePaymentStatus = async (
  paymentId: string,
  status: Payment['status'],
  externalPaymentId?: string
) => {
  const payment = await paymentRepository.findPaymentById(paymentId);
  if (!payment) throw new Error('Payment not found');

  const updateData: Partial<Payment> = { status };
  if (externalPaymentId) {
    updateData.externalPaymentId = externalPaymentId;
  }

  const updatedPayment = await paymentRepository.updatePayment(
    payment,
    updateData
  );
  logger.info(`Payment ${paymentId} status updated to ${status}`);
  return updatedPayment;
};

// Получает историю платежей пользователя
export const getUserPaymentHistory = async (
  userId: string,
  page: number = 1,
  limit: number = 20
) => {
  const offset = (page - 1) * limit;
  const result = await paymentRepository.getUserPayments(userId, limit, offset);
  return {
    payments: result.rows,
    total: result.count,
    page,
    limit,
    totalPages: Math.ceil(result.count / limit),
  };
};

// Получает платеж по ID
export const getPaymentById = async (paymentId: string) => {
  const payment = await paymentRepository.findPaymentById(paymentId);
  if (!payment) throw new Error('Payment not found');
  return payment;
};

// Получает платеж по внешнему ID
export const getPaymentByExternalId = async (externalPaymentId: string) => {
  const payment =
    await paymentRepository.findPaymentByExternalId(externalPaymentId);
  if (!payment) throw new Error('Payment not found');
  return payment;
};

// Получает платежи по статусу
export const getPaymentsByStatus = async (
  status: Payment['status'],
  page: number = 1,
  limit: number = 20
) => {
  const offset = (page - 1) * limit;
  const result = await paymentRepository.findPaymentsByStatus(
    status,
    limit,
    offset
  );
  return {
    payments: result.rows,
    total: result.count,
    page,
    limit,
    totalPages: Math.ceil(result.count / limit),
  };
};

// Создает платеж и получает токен от платежной системы
export const createPaymentWithToken = async (paymentData: {
  userId: string;
  amount: number;
  currency?: string;
  paymentMethod: string;
  paymentProvider: 'bepaid';
  description?: string;
  metadata?: Record<string, any>;
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    address?: string;
    country?: string;
    city?: string;
    phone?: string;
  };
  bePaidSettings?: bePaidService.BePaidCheckoutRequest['checkout']['settings'];
}) => {
  // Создаем платеж в базе данных
  const payment = await paymentRepository.createPayment({
    userId: paymentData.userId,
    amount: paymentData.amount,
    currency: paymentData.currency || 'RUB',
    paymentMethod: paymentData.paymentMethod,
    paymentProvider: paymentData.paymentProvider,
    description: paymentData.description,
    metadata: paymentData.metadata,
    status: 'pending',
  });

  logger.info(`Payment created: ${payment.id} for user ${paymentData.userId}`);

  // Получаем токен от платежной системы в зависимости от провайдера
  let paymentToken: string | undefined;
  let redirectUrl: string | undefined;

  if (paymentData.paymentProvider === 'bepaid') {
    try {
      const bePaidResponse = await bePaidService.createPaymentToken(
        paymentData.amount,
        paymentData.currency || 'RUB',
        paymentData.description || 'Payment',
        paymentData.userId,
        payment.id,
        {
          test:
            process.env.BEPAID_TEST === 'true' ||
            process.env.BEPAID_TEST === '1',
          customer: paymentData.customer,
          settings: paymentData.bePaidSettings,
        }
      );

      paymentToken = bePaidResponse.checkout.token;
      redirectUrl = bePaidResponse.checkout.redirect_url;

      // Обновляем платеж с токеном и URL
      await paymentRepository.updatePayment(payment, {
        paymentToken,
        redirectUrl,
      });

      logger.info(
        `Payment token received for payment ${payment.id}: ${paymentToken}`
      );
    } catch (error: any) {
      logger.error(
        `Failed to create payment token for payment ${payment.id}: ${error.message}`
      );
      // Обновляем статус на failed, если не удалось получить токен
      await paymentRepository.updatePayment(payment, {
        status: 'failed',
      });
      throw new Error(`Failed to create payment token: ${error.message}`);
    }
  } else {
    // Для других платежных систем можно добавить аналогичную логику
    logger.warn(
      `Payment provider ${paymentData.paymentProvider} is not yet implemented`
    );
  }

  return {
    payment,
    paymentToken,
    redirectUrl,
  };
};

// Обрабатывает webhook уведомление от bePaid
// Находит платеж, обновляет статус и начисляет токены при успешном платеже
export const handleBePaidWebhook = async (
  webhookData: bePaidService.BePaidWebhookNotification
): Promise<{ success: boolean; payment?: Payment; message: string }> => {
  try {
    // Получаем данные транзакции из webhook
    const transaction = webhookData.transaction || webhookData.payment;
    if (!transaction) {
      logger.error('BePaid webhook: transaction data not found');
      return { success: false, message: 'Transaction data not found' };
    }

    const transactionUid = transaction.tracking_id;
    const status = transaction.status;
    const amount = transaction.amount / 100; // bePaid передает сумму в копейках/центах
    const currency = transaction.currency;

    logger.info(
      `BePaid webhook received: transaction ${transactionUid}, status: ${status}`
    );

    // Ищем платеж по externalPaymentId (uid транзакции)
    const payment = await paymentRepository.findPaymentById(transactionUid);

    if (!payment) {
      logger.warn(
        `BePaid webhook: payment not found for transaction ${transactionUid}`
      );
      return {
        success: false,
        message: `Payment not found for transaction ${transactionUid}`,
      };
    }

    // Определяем статус платежа в нашей системе
    let paymentStatus: Payment['status'] = 'pending';
    if (status === 'successful') {
      paymentStatus = 'completed';
    } else if (status === 'failed' || status === 'expired') {
      paymentStatus = 'failed';
    }

    // Обновляем платеж в транзакции базы данных
    const result = await db.transaction(async (t) => {
      // Сохраняем исходный статус для проверки необходимости начисления токенов
      const originalStatus = payment!.status;

      logger.info(
        `Processing payment ${payment!.id}: original status = ${originalStatus}, new status = ${paymentStatus}`
      );

      // Обновляем статус платежа
      const updatedPayment = await paymentRepository.updatePayment(
        payment!,
        {
          status: paymentStatus,
          externalPaymentId: transactionUid,
        },
        t
      );

      if (
        status === 'successful' &&
        originalStatus !== 'completed' &&
        originalStatus !== 'refunded'
      ) {
        const meta = payment!.metadata as { planOperation?: string; planId?: string } | undefined;
        const planOperation = meta?.planOperation;
        const planId = meta?.planId;
        const userId = payment!.userId;

        if (planOperation && planId) {
          try {
            if (planOperation === 'package') {
              await userPlanService.purchasePackage(userId, planId);
              logger.info(`Plan package fulfilled: payment ${payment!.id}, planId ${planId}`);
            } else if (planOperation === 'subscription') {
              await userPlanService.subscribe(userId, planId);
              logger.info(`Plan subscription fulfilled: payment ${payment!.id}, planId ${planId}`);
            } else if (planOperation === 'upgrade') {
              await userPlanService.upgrade(userId, planId);
              logger.info(`Plan upgrade fulfilled: payment ${payment!.id}, planId ${planId}`);
            } else if (planOperation === 'topup') {
              await topUpService.purchaseTopUp(userId, planId, payment!.id);
              logger.info(`Plan top-up fulfilled: payment ${payment!.id}, planId ${planId}`);
            } else {
              throw new Error(`Unknown planOperation: ${planOperation}`);
            }
          } catch (error: unknown) {
            logger.error(
              `Failed to fulfill plan for payment ${payment!.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        } else {
          try {
            const finalTokens = await calculateTokensFromPayment(amount, currency);
            logger.info(
              `Calculating tokens: ${amount} ${currency} -> ${finalTokens} tokens (rate: ${process.env.PAYMENT_TO_TOKENS_RATE || 1} RUB per token)`
            );
            await performTransaction(
              userId,
              finalTokens,
              'credit',
              `Payment completed: ${amount} ${currency} (Transaction: ${transactionUid})`,
              t
            );
            logger.info(
              `Tokens credited: ${finalTokens} tokens for user ${userId} (payment ${payment!.id})`
            );
          } catch (error: unknown) {
            logger.error(
              `Failed to credit tokens for payment ${payment!.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      } else {
        logger.info(
          `Payment ${payment!.id} skipped token credit: status=${status}, originalStatus=${originalStatus}`
        );
      }

      return updatedPayment;
    });

    logger.info(
      `BePaid webhook processed: payment ${result.id}, status: ${paymentStatus}`
    );

    return {
      success: true,
      payment: result,
      message: 'Webhook processed successfully',
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Error processing BePaid webhook: ${msg}`);
    return {
      success: false,
      message: `Error processing webhook: ${msg}`,
    };
  }
};
