import axios from "axios";
import crypto from "crypto";
import logger from "../../../shared/utils/logger";

const BEPAID_SHOP_ID = process.env.BEPAID_SHOP_ID;
const BEPAID_SECRET_KEY = process.env.BEPAID_SECRET_KEY;
const BEPAID_PUBLIC_KEY = process.env.BEPAID_PUBLIC_KEY;
const BEPAID_CHECKOUT_URL = "https://checkout.bepaid.by/ctp/api/checkouts";
const BEPAID_API_URL = process.env.BEPAID_API_URL || "https://api.bepaid.by";
const BACKEND_URL = process.env.BACKEND_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;
// Определяет тестовый режим bePaid (по умолчанию false, если не указано)
const BEPAID_TEST = process.env.BEPAID_TEST === "true" || process.env.BEPAID_TEST === "1";

// Интерфейс для запроса создания токена платежа bePaid
export interface BePaidCheckoutRequest {
  checkout: {
    test?: boolean;
    transaction_type: "payment";
    attempts?: number;
    iframe?: boolean;
    settings?: {
      return_url?: string;
      success_url?: string;
      decline_url?: string;
      fail_url?: string;
      cancel_url?: string;
      notification_url?: string;
      auto_return?: number;
      auto_pay?: boolean;
      language?: string;
      payment_method?: {
        types?: string[];
        credit_card?: {
          token?: string;
        };
      };
      customer_fields?: {
        visible?: string[];
        read_only?: string[];
      };
      agreed?: boolean;
      agreement_toggle?: {
        value: boolean;
        url: string;
        text: string;
      };
      button_next_text?: string;
    };
    order: {
      currency: string;
      amount: number;
      description: string;
      expired_at?: string;
      additional_data?: {
        receipt_text?: string[];
      };
    };
    customer?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      address?: string;
      country?: string;
      city?: string;
      phone?: string;
    };
    travel?: any;
  };
}

// Интерфейс для ответа bePaid
export interface BePaidCheckoutResponse {
  checkout: {
    token: string;
    redirect_url: string;
  };
  errors?: any;
  message?: string;
}

// Интерфейс для webhook уведомления от bePaid
export interface BePaidWebhookNotification {
  transaction: {
    uid: string;
    status: "successful" | "failed" | "pending" | "expired";
    type: string;
    message: string;
    amount: number;
    currency: string;
    test: boolean;
    created_at: string;
    updated_at: string;
    payment_method_type?: string;
    payment_method?: any;
    billing_address?: any;
    customer?: {
      email?: string;
      first_name?: string;
      last_name?: string;
    };
  };
  payment?: {
    uid: string;
    status: string;
    type: string;
    message: string;
    amount: number;
    currency: string;
    test: boolean;
    created_at: string;
    updated_at: string;
  };
  order?: {
    uid: string;
    amount: number;
    currency: string;
    description?: string;
    tracking_id?: string;
  };
}

// Создает токен платежа в bePaid
export const createPaymentToken = async (
  amount: number,
  currency: string,
  description: string,
  userId: string,
  paymentId: string,
  options?: {
    test?: boolean;
    customer?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      address?: string;
      country?: string;
      city?: string;
      phone?: string;
    };
    settings?: BePaidCheckoutRequest["checkout"]["settings"];
  },
): Promise<BePaidCheckoutResponse> => {
  if (!BEPAID_SHOP_ID || !BEPAID_SECRET_KEY) {
    throw new Error("BePaid credentials are not configured");
  }

  // Базовые настройки URL для уведомлений и возврата
  const baseUrl = BACKEND_URL || "http://localhost:5000";
  const frontendUrl = FRONTEND_URL || "http://localhost:3000";
  const notificationUrl = `${baseUrl}/api/payment/webhook/bepaid`;
  const returnUrl = `${baseUrl}/payment/return`;

  const requestData: BePaidCheckoutRequest = {
    checkout: {
      test: options?.test ?? BEPAID_TEST,
      transaction_type: "payment",
      attempts: 3,
      settings: {
        success_url: `${frontendUrl}/payment/success?payment_id=${paymentId}`,
        decline_url: `${frontendUrl}/payment/decline?payment_id=${paymentId}`,
        fail_url: `${frontendUrl}/payment/fail?payment_id=${paymentId}`,
        cancel_url: `${frontendUrl}/payment/cancel?payment_id=${paymentId}`,
        notification_url: notificationUrl,
        auto_return: 3,
        language: "ru",
        ...options?.settings,
      },
      order: {
        currency: currency.toUpperCase(),
        amount: Math.round(amount * 100), // bePaid принимает сумму в копейках/центах
        description: description,
      },
      customer: options?.customer,
    },
  };

  try {
    // Базовая авторизация для bePaid API
    const auth = Buffer.from(
      `${BEPAID_SHOP_ID}:${BEPAID_SECRET_KEY}`,
    ).toString("base64");

    const response = await axios.post<BePaidCheckoutResponse>(
      BEPAID_CHECKOUT_URL,
      requestData,
      {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Accept": "application/json",
          "X-API-Version": "2",
          "Authorization": `Basic ${auth}`,
        },
      },
    );

    if (response.data.errors) {
      logger.error(
        `BePaid API Error: ${JSON.stringify(response.data.errors)}`,
      );
      throw new Error(
        response.data.message || "Failed to create payment token",
      );
    }

    logger.info(
      `Payment token created for payment ${paymentId}: ${response.data.checkout.token}`,
    );
    return response.data;
  } catch (error: any) {
    logger.error(
      `BePaid API Error: ${error.response?.data?.message || error.message}`,
    );
    throw new Error(
      `Failed to create payment token: ${error.response?.data?.message || error.message}`,
    );
  }
};

// Получает статус транзакции по токену
export const getPaymentStatusByToken = async (
  token: string,
): Promise<any> => {
  if (!BEPAID_SHOP_ID || !BEPAID_SECRET_KEY) {
    throw new Error("BePaid credentials are not configured");
  }

  const auth = Buffer.from(
    `${BEPAID_SHOP_ID}:${BEPAID_SECRET_KEY}`,
  ).toString("base64");

  try {
    const response = await axios.get(
      `${BEPAID_API_URL}/beyag/payments/${token}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      },
    );
    return response.data;
  } catch (error: any) {
    logger.error(
      `BePaid Status Error: ${error.response?.data?.message || error.message}`,
    );
    throw new Error(
      `Failed to get payment status: ${error.response?.data?.message || error.message}`,
    );
  }
};

// Проверяет цифровую подпись webhook уведомления от bePaid
// Принимает тело запроса в байтовом формате и подпись из заголовка Content-Signature
export const verifyWebhookSignature = (
  rawBody: Buffer,
  signature: string,
): boolean => {
  if (!BEPAID_PUBLIC_KEY) {
    logger.warn("BEPAID_PUBLIC_KEY is not configured, skipping signature verification");
    return false;
  }

  try {
    // Декодируем подпись из base64
    const signatureBuffer = Buffer.from(signature, "base64");

    // Форматируем публичный ключ (добавляем заголовки если их нет)
    let publicKey = BEPAID_PUBLIC_KEY;
    if (!publicKey.includes("BEGIN PUBLIC KEY")) {
      publicKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
    }

    // Проверяем подпись используя SHA256
    const verify = crypto.createVerify("SHA256");
    verify.update(rawBody);
    verify.end();

    const isValid = verify.verify(publicKey, signatureBuffer);

    if (!isValid) {
      logger.warn("BePaid webhook signature verification failed");
    }

    return isValid;
  } catch (error: any) {
    logger.error(`Error verifying BePaid webhook signature: ${error.message}`);
    return false;
  }
};