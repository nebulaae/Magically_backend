import { History } from "../model/History";

export const createHistory = (data: {
    userId: string;
    service: "kling" | "higgsfield" | "gpt" | "nano" | "replicate";
    serviceTaskId?: string;
    status: "pending" | "processing" | "completed" | "failed";
    tokensSpent: number;
    prompt?: string;
    metadata?: Record<string, any>;
}) => {
    return History.create(data);
};

export const findHistoryById = (id: string) => {
    return History.findByPk(id);
};

export const findHistoryByTaskId = (serviceTaskId: string) => {
    return History.findOne({ where: { serviceTaskId } });
};

export const findUserHistory = (
    userId: string,
    limit: number,
    offset: number,
) => {
    return History.findAndCountAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
        limit,
        offset,
    });
};

export const updateHistory = (
    history: History,
    updates: Partial<History>,
) => {
    Object.assign(history, updates);
    return history.save();
};

export const findPendingHistory = () => {
    return History.findAll({
        where: { status: ["pending", "processing"] },
    });
};