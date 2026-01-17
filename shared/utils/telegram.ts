import crypto from 'crypto';

export const verifyTelegramWebAppData = (telegramInitData: string): any => {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN is not defined");
  }

  const urlParams = new URLSearchParams(telegramInitData);

  const receivedHash = urlParams.get('hash');
  if (!receivedHash) return null;

  urlParams.delete('hash');

  // Собираем и сортируем пары key=value
  const dataPairs: string[] = [];
  urlParams.forEach((value, key) => {
    dataPairs.push(`${key}=${value}`);
  });
  dataPairs.sort();

  const dataCheckString = dataPairs.join('\n');

  // Для Login Widget — secret это просто SHA256 от bot_token (НЕ HMAC!)
  const secretKey = crypto.createHash('sha256').update(BOT_TOKEN).digest();

  // Вычисляем HMAC от dataCheckString с этим secret
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