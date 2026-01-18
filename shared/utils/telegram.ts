import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const verifyTelegramWebAppData = (telegramInitData: string): any => {

  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined");
  }

  const urlParams = new URLSearchParams(telegramInitData);

  const receivedHash = urlParams.get('hash');
  if (!receivedHash) return null;

  urlParams.delete('hash');

  const dataPairs: string[] = [];
  urlParams.forEach((value, key) => {
    dataPairs.push(`${key}=${value}`);
  });
  dataPairs.sort();

  const dataCheckString = dataPairs.join('\n');

  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (computedHash !== receivedHash) {
    console.log('Hash mismatch!');
    console.log('Computed: ', computedHash);
    console.log('Received: ', receivedHash);
    console.log('Data check string was:\n', dataCheckString);
    return null;
  }

  // Достаём user
  const userStr = urlParams.get('user');
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch (e) {
    console.error('Failed to parse user JSON', e);
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