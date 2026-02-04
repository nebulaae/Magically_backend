import logger from "../../../shared/utils/logger";
import { Request, Response } from "express";
import * as paymentService from "../service/paymentService";
import * as apiResponse from "../../../shared/utils/apiResponse";

// Обработка ошибок
const handleErrors = (error: Error, res: Response) => {
  logger.error(error.message);
  if (error.message.includes("not found"))
    return apiResponse.notFound(res, error.message);
  if (error.message.includes("already"))
    return apiResponse.conflict(res, error.message);
  apiResponse.internalError(res, "Server error");
};

// Создает новый платеж
export const createPayment = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { amount, currency, paymentMethod, paymentProvider, description, metadata } = req.body;

    if (!amount || !paymentMethod) {
      return apiResponse.badRequest(
        res,
        "Amount and payment method are required",
      );
    }

    const payment = await paymentService.createPayment({
      userId,
      amount,
      currency,
      paymentMethod,
      paymentProvider,
      description,
      metadata,
    });

    apiResponse.success(res, { payment }, "Payment created successfully");
  } catch (error) {
    handleErrors(error as Error, res);
  }
};

// Создает платеж и возвращает токен для оплаты
export const createPaymentWithToken = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const {
      amount,
      currency,
      paymentMethod,
      paymentProvider,
      description,
      metadata,
      customer,
      bePaidSettings,
    } = req.body;

    if (!amount || !paymentMethod || !paymentProvider) {
      return apiResponse.badRequest(
        res,
        "Amount, payment method and payment provider are required",
      );
    }

    // Валидация провайдера
    const validProviders = ["bepaid"];
    if (!validProviders.includes(paymentProvider)) {
      return apiResponse.badRequest(res, "Invalid payment provider");
    }

    const result = await paymentService.createPaymentWithToken({
      userId,
      amount: Number(amount),
      currency,
      paymentMethod,
      paymentProvider,
      description,
      metadata,
      customer,
      bePaidSettings,
    });

    apiResponse.success(
      res,
      {
        payment: result.payment,
        paymentToken: result.paymentToken,
        redirectUrl: result.redirectUrl,
      },
      "Payment created successfully",
    );
  } catch (error) {
    handleErrors(error as Error, res);
  }
};

// Получает историю платежей текущего пользователя
export const getMyPayments = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { page = "1", limit = "20" } = req.query;

    const result = await paymentService.getUserPaymentHistory(
      userId,
      Number(page),
      Number(limit),
    );

    apiResponse.success(res, result);
  } catch (error) {
    handleErrors(error as Error, res);
  }
};

// Получает платеж по ID
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const paymentId = Array.isArray(req.params.paymentId)
      ? req.params.paymentId[0]
      : req.params.paymentId;
    const payment = await paymentService.getPaymentById(paymentId);

    // Проверяем, что платеж принадлежит текущему пользователю или пользователь - админ
    if (payment.userId !== req.user.id && req.user.role !== "admin") {
      return apiResponse.forbidden(res, "Access denied");
    }

    apiResponse.success(res, { payment });
  } catch (error) {
    handleErrors(error as Error, res);
  }
};

// Обновляет статус платежа (только для админов)
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const paymentId = Array.isArray(req.params.paymentId)
      ? req.params.paymentId[0]
      : req.params.paymentId;
    const { status, externalPaymentId } = req.body;

    if (!status) {
      return apiResponse.badRequest(res, "Status is required");
    }

    const validStatuses = [
      "pending",
      "completed",
      "failed",
      "refunded",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return apiResponse.badRequest(res, "Invalid status");
    }

    const payment = await paymentService.updatePaymentStatus(
      paymentId,
      status,
      externalPaymentId,
    );

    apiResponse.success(res, { payment }, "Payment status updated successfully");
  } catch (error) {
    handleErrors(error as Error, res);
  }
};

