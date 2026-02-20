import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const verifyTelegramWebAppData = (initDataRaw: string) => {
  const params = new URLSearchParams(initDataRaw);

  const hash = params.get('hash');
  if (!hash) return null;

  const authDate = Number(params.get('auth_date'));
  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - authDate) > 300) {
    console.log('InitData outdated');
    return null;
  }

  // формируем data_check_string
  const data: string[] = [];

  params.forEach((value, key) => {
    if (key === 'hash') return;
    data.push(`${key}=${value}`);
  });

  data.sort();
  const dataCheckString = data.join('\n');

  // secret_key = HMAC_SHA256(bot_token, "WebAppData")
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(BOT_TOKEN)
    .digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) {
    console.log('Hash mismatch');
    return null;
  }

  // parse user
  const userRaw = params.get('user');
  if (!userRaw) return null;

  console.log('Telegram WebApp VALIDATED');
  console.log('User:', userRaw);

  return JSON.parse(decodeURIComponent(userRaw));
};

export const verifyTelegramLoginWidget = (data: any) => {
  const { hash, ...rest } = data;

  const dataCheckString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join('\n');

  const secret = crypto.createHash('sha256').update(BOT_TOKEN).digest();

  const computedHash = crypto
    .createHmac('sha256', secret)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== hash) return null;

  return rest;
};
