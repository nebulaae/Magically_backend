import crypto from 'crypto';
import dotenv from 'dotenv';
import logger from './logger';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const verifyTelegramWebAppData = (initDataRaw: string): any => {
  const urlParams = new URLSearchParams(initDataRaw);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  // Сортировка ключей в алфавитном порядке
  const restKeys = Array.from(urlParams.keys()).sort();

  // Формирование строки проверки (key=value\n)
  const dataCheckString = restKeys
    .map((key) => `${key}=${urlParams.get(key)}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(process.env.TELEGRAM_BOT_TOKEN!)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    logger.warn(`TG Hash mismatch. Computed: ${computedHash}, Received: ${hash}`);
    return null;
  }

  // Парсинг пользователя
  const userStr = urlParams.get("user");
  if (userStr) {
    return JSON.parse(userStr);
  }
  return null;
};

export const verifyTelegramLoginWidget = (data: any) => {
  const { hash, ...rest } = data;

  const dataCheckString = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key]}`)
    .join("\n");

  const secret = crypto
    .createHash("sha256")
    .update(BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return null;

  return rest;
}