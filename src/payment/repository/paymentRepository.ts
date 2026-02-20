import { Payment } from '../models/Payment';
import { Transaction as SequelizeTransaction } from 'sequelize';

// Создает новый платеж в базе данных
export const createPayment = (
  data: Partial<Payment>,
  t?: SequelizeTransaction
) => {
  return Payment.create(data as any, { transaction: t });
};

// Находит платеж по ID
export const findPaymentById = (paymentId: string) => {
  return Payment.findByPk(paymentId);
};

// Находит платеж по внешнему ID платежа
export const findPaymentByExternalId = (externalPaymentId: string) => {
  return Payment.findOne({
    where: { externalPaymentId },
  });
};

// Находит платеж по токену платежа
export const findPaymentByToken = (paymentToken: string) => {
  return Payment.findOne({
    where: { paymentToken },
  });
};

// Получает все платежи пользователя с пагинацией
export const getUserPayments = (
  userId: string,
  limit: number = 20,
  offset: number = 0
) => {
  return Payment.findAndCountAll({
    where: { userId },
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
};

// Обновляет платеж
export const updatePayment = (
  payment: Payment,
  data: Partial<Payment>,
  t?: SequelizeTransaction
) => {
  return payment.update(data, { transaction: t });
};

// Находит платежи по статусу
export const findPaymentsByStatus = (
  status: Payment['status'],
  limit: number = 20,
  offset: number = 0
) => {
  return Payment.findAndCountAll({
    where: { status },
    limit,
    offset,
    order: [['createdAt', 'DESC']],
  });
};
