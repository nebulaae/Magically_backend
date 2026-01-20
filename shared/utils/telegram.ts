import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const verifyTelegramWebAppData = (initData: string) => {
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined");
  }

  // ⚠️ ВАЖНО: парсим как есть
  const params = new URLSearchParams(initData);

  const hash = params.get("hash");
  if (!hash) return null;

  params.delete("hash");

  const dataCheckArr: string[] = [];

  // ⚠️ Telegram требует DECODED значения
  params.forEach((value, key) => {
    dataCheckArr.push(`${key}=${value}`);
  });

  dataCheckArr.sort();

  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = crypto
    .createHash("sha256")
    .update(BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    console.error("Telegram hash mismatch");
    console.error({ dataCheckString, computedHash, hash });
    return null;
  }

  const userRaw = params.get("user");
  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
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