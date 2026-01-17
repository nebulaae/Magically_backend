import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const verifyTelegramWebAppData = (telegramInitData: string): any => {
    if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not defined");

    const urlParams = new URLSearchParams(telegramInitData);
    const hash = urlParams.get('hash');
    urlParams.delete('hash');

    const paramsList: string[] = [];
    urlParams.forEach((value, key) => paramsList.push(`${key}=${value}`));
    paramsList.sort();
    const dataCheckString = paramsList.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash === hash) {
        const userStr = urlParams.get('user');
        if (userStr) return JSON.parse(userStr);
    }
    return null;
};