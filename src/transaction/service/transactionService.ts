import db from '../../../shared/config/database';
import { User } from '../../user/models/User';
import * as transactionRepository from '../repository/transcationRepository';

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

export const getUserHistory = async (
  userId: string,
  page: number,
  limit: number
) => {
  const offset = (page - 1) * limit;
  return await transactionRepository.getUserTransactions(userId, limit, offset);
};