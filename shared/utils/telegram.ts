import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export const verifyTelegramWebAppData = (initDataRaw: string): any => {
  const pairs = initDataRaw.split("&");
  let hash = "";
  const data: string[] = [];
  let userRaw = "";

  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;

    const key = pair.slice(0, idx);
    const value = pair.slice(idx + 1);

    if (key === "hash") {
      hash = value;
      continue;
    }

    if (key === "signature") {
      continue;
    }

    // ⚠️ Сохраняем RAW значение (без decode!)
    data.push(`${key}=${value}`);

    if (key === "user") {
      userRaw = value;
    }
  }

  data.sort();
  const dataCheckString = data.join("\n");

  // ШАГ 1: secret = HMAC_SHA256("WebAppData", BOT_TOKEN)
  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN!)
    .digest();

  // ШАГ 2: финальный хеш
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  console.log("=== DEBUG ===");
  console.log("Data check string:");
  console.log(dataCheckString);
  console.log("\nComputed hash:", computedHash);
  console.log("Received hash:", hash);
  console.log("Match:", computedHash === hash);

  if (computedHash !== hash) {
    return null;
  }

  // Парсим user (теперь с decode)
  try {
    if (userRaw) {
      const decoded = decodeURIComponent(userRaw);
      return JSON.parse(decoded);
    }
    return null;
  } catch (error) {
    console.error("Failed to parse user data:", error);
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