import { Transaction } from "../models/Transaction";
import { Transaction as SequelizeTransaction } from "sequelize";

export const createTransaction = (data: Partial<Transaction>, t: SequelizeTransaction) => {
    return Transaction.create(data as any, { transaction: t });
};

export const getUserTransactions = (userId: string, limit: number = 20, offset: number = 0) => {
    return Transaction.findAndCountAll({
        where: { userId },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
    });
};