import db from '../../../shared/config/database';
import { User } from '../../user/models/User';
import * as transactionRepository from '../repository/transcationRepository';
import * as userPlanRepository from '../../plans/repository/userPlanRepository';
import * as userPlanService from '../../plans/service/userPlanService';

export const performTransaction = async (
  userId: string,
  amount: number,
  type: 'credit' | 'debit',
  description: string,
  externalTransaction?: any
) => {
  const transactionCallback = async (t: any) => {
    const user = await User.findByPk(userId, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!user) throw new Error('User not found');

    if (type === 'debit') {
      if (user.tokens < amount) throw new Error('Insufficient tokens');
      user.tokens -= amount;
    } else {
      user.tokens += amount;
    }

    await user.save({ transaction: t });

    await transactionRepository.createTransaction(
      {
        userId,
        amount,
        type,
        description,
      },
      t
    );

    return user.tokens;
  };

  if (externalTransaction) {
    return await transactionCallback(externalTransaction);
  } else {
    return await db.transaction(transactionCallback);
  }
};

export const checkUserBalance = async (
  userId: string,
  requiredAmount: number
): Promise<boolean> => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  return user.tokens >= requiredAmount;
};

export const getSpendableBalance = async (
  userId: string
): Promise<{ balance: number; source: 'plan' | 'legacy' }> => {
  const up = await userPlanRepository.findActiveByUserId(userId);
  if (up) {
    const balance = up.tokensFromPlan + up.tokensFromTopup;
    if (balance > 0) {
      return { balance, source: 'plan' };
    }
  }
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');
  return { balance: user.tokens, source: 'legacy' };
};

export const canSpendTokens = async (
  userId: string,
  requiredAmount: number
): Promise<boolean> => {
  const { balance } = await getSpendableBalance(userId);
  return balance >= requiredAmount;
};

export const spendTokens = async (
  userId: string,
  amount: number,
  description: string,
  externalTransaction?: any
): Promise<void> => {
  if (amount <= 0) throw new Error('Amount must be positive');
  const tryPlanFirst = async (t?: any) => {
    try {
      await userPlanService.consumeTokens(userId, amount, t);
      return;
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg === 'No active plan' || msg === 'Insufficient tokens') {
        await performTransaction(userId, amount, 'debit', description, t);
        return;
      }
      throw e;
    }
  };
  if (externalTransaction) {
    await tryPlanFirst(externalTransaction);
  } else {
    await tryPlanFirst();
  }
};

export const getUserHistory = async (
  userId: string,
  page: number,
  limit: number
) => {
  const offset = (page - 1) * limit;
  return await transactionRepository.getUserTransactions(userId, limit, offset);
};
