import * as historyRepository from "../repository/historyRepository";

export const createGenerationHistory = async (data: {
    userId: string;
    service: "kling" | "higgsfield" | "gpt" | "nano" | "replicate";
    serviceTaskId?: string;
    tokensSpent: number;
    prompt?: string;
    metadata?: Record<string, any>;
}) => {
    return historyRepository.createHistory({
        ...data,
        status: "pending",
    });
};

export const getUserHistory = async (
    userId: string,
    page: number = 1,
    limit: number = 20,
) => {
    const offset = (page - 1) * limit;
    const { count, rows } = await historyRepository.findUserHistory(
        userId,
        limit,
        offset,
    );

    return {
        history: rows,
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
    };
};

export const updateHistoryStatus = async (
    historyId: string,
    status: "processing" | "completed" | "failed",
    updates?: {
        resultUrl?: string;
        errorMessage?: string;
        serviceTaskId?: string;
    },
) => {
    const history = await historyRepository.findHistoryById(historyId);
    if (!history) {
        throw new Error("History record not found");
    }

    return historyRepository.updateHistory(history, {
        status,
        ...updates,
    });
};

export const getHistoryById = async (historyId: string) => {
    const history = await historyRepository.findHistoryById(historyId);
    if (!history) {
        throw new Error("History record not found");
    }
    return history;
};