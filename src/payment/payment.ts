import express from "express";
import * as paymentController from "./controller/paymentController";
import * as webhookController from "./controller/webhookController";
import * as currencyController from "./controller/currencyController";

import { auth } from "../../shared/middleware/auth";
import { adminAuth } from "../../shared/middleware/adminAuth";
import { asyncHandler } from "../../shared/utils/asyncHandler";

const router = express.Router();

// Создать новый платеж - REQUIRES AUTH
router.post(
  "/",
  auth,
  asyncHandler(paymentController.createPayment),
);

// Создать платеж и получить токен для оплаты - REQUIRES AUTH
router.post(
  "/token",
  auth,
  asyncHandler(paymentController.createPaymentWithToken),
);

// Получить историю платежей текущего пользователя - REQUIRES AUTH
router.get(
  "/me",
  auth,
  asyncHandler(paymentController.getMyPayments),
);

// Получить валюту по IP адресу - NO AUTH REQUIRED (публичный endpoint)
// Должен быть выше /:paymentId, чтобы не конфликтовать с параметризованным роутом
router.get(
  "/currency",
  asyncHandler(currencyController.getCurrency),
);

// Рассчитать количество токенов по сумме и валюте - NO AUTH REQUIRED (публичный endpoint)
router.get(
  "/tokens/calculate",
  asyncHandler(currencyController.calculateTokens),
);

// Получить платеж по ID - REQUIRES AUTH
router.get(
  "/:paymentId",
  auth,
  asyncHandler(paymentController.getPaymentById),
);

// Обновить статус платежа - REQUIRES ADMIN
router.put(
  "/:paymentId/status",
  adminAuth,
  asyncHandler(paymentController.updatePaymentStatus),
);

// Webhook для уведомлений от bePaid - NO AUTH REQUIRED (внешний сервис)
// Raw body middleware применяется в main.ts перед express.json()
router.post(
  "/webhook/bepaid",
  asyncHandler(webhookController.handleBePaidWebhook),
);

export default router;

