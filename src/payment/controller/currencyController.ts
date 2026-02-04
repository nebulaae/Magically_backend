import { Request, Response } from "express";
import logger from "../../../shared/utils/logger";
import * as currencyService from "../service/currencyService";
import { calculateTokensFromPayment } from "../service/currencyConversionService";
import * as apiResponse from "../../../shared/utils/apiResponse";

// Получает валюту по IP адресу пользователя
export const getCurrency = async (req: Request, res: Response) => {
  try {
    // Получаем IP адрес из запроса
    const ip = currencyService.getClientIP(req);

    // Определяем валюту по IP
    const result = await currencyService.getCurrencyByIP(ip);

    apiResponse.success(res, result);
  } catch (error: any) {
    logger.error(`Error in getCurrency controller: ${error.message}`);
    // В случае ошибки возвращаем дефолтную валюту
    apiResponse.success(res, {
      currency: "RUB",
      country: null,
      ip: null,
    });
  }
};

// Рассчитывает количество токенов по сумме и валюте
export const calculateTokens = async (req: Request, res: Response) => {
  try {
    const { amount, currency } = req.query;

    if (!amount || !currency) {
      return apiResponse.badRequest(
        res,
        "Amount and currency are required",
      );
    }

    const amountNum = Number(amount);
    const currencyStr = String(currency);

    if (isNaN(amountNum) || amountNum <= 0) {
      return apiResponse.badRequest(res, "Amount must be a positive number");
    }

    // Рассчитываем количество токенов
    const tokens = await calculateTokensFromPayment(amountNum, currencyStr);

    apiResponse.success(res, {
      amount: amountNum,
      currency: currencyStr,
      tokens,
    });
  } catch (error: any) {
    logger.error(`Error in calculateTokens controller: ${error.message}`);
    apiResponse.internalError(res, "Failed to calculate tokens");
  }
};
