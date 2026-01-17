import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const verifyTelegramWebAppData = (telegramInitData: string): any => {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined in environment");
  }

  if (!telegramInitData || typeof telegramInitData !== 'string') {
    return null;
  }

  const urlParams = new URLSearchParams(telegramInitData);

  const hash = urlParams.get('hash');
  if (!hash) return null;

  urlParams.delete('hash');

  const paramsList: string[] = [];
  urlParams.forEach((value, key) => {
    if (value.length > 4096) return null;
    paramsList.push(`${key}=${value}`);
  });

  paramsList.sort((a, b) => a.localeCompare(b));

  const dataCheckString = paramsList.join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash !== hash) {
    return null;
  }

  const userStr = urlParams.get('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};