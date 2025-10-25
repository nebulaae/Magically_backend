import Redis from "ioredis";
import dotenv from "dotenv";
import logger from "../utils/logger";

dotenv.config();

export const redisClient = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT, 10),
  maxRetriesPerRequest: 3,
  // Добавлена стратегия переподключения
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    // logger.info(`Redis: Retrying connection in ${delay}ms...`);
    return delay;
  },
});

redisClient.on("connect", () => {
  logger.info("Successfully connected to Redis.");
});

redisClient.on("error", (err) => {
  // logger.error(`Redis connection error: ${err.message}`);
});

// Проверяем, готов ли клиент к работе
const isRedisReady = () => redisClient.status === "ready";

export const getFromCache = async <T>(key: string): Promise<T | null> => {
  if (!isRedisReady()) {
    logger.warn("Redis is not ready, skipping cache GET.");
    return null;
  }
  try {
    const data = await redisClient.get(key);
    if (data) {
      return JSON.parse(data) as T;
    }
    return null;
  } catch (error) {
    logger.error(`Error getting from cache for key ${key}: ${error.message}`);
    return null;
  }
};

export const setInCache = async (
  key: string,
  value: any,
  ttlSeconds: number = 3600,
): Promise<void> => {
  if (!isRedisReady()) {
    logger.warn("Redis is not ready, skipping cache SET.");
    return;
  }
  try {
    const stringifiedValue = JSON.stringify(value);
    await redisClient.set(key, stringifiedValue, "EX", ttlSeconds);
  } catch (error) {
    logger.error(`Error setting cache for key ${key}: ${error.message}`);
  }
};

// Функция для удаления кеша по ключу или паттерну
export const invalidateCache = async (keyOrPattern: string): Promise<void> => {
  if (!isRedisReady()) {
    logger.warn("Redis is not ready, skipping cache INVALIDATE.");
    return;
  }
  try {
    // Если это паттерн (содержит *), используем SCAN и DEL
    if (keyOrPattern.includes("*")) {
      const stream = redisClient.scanStream({
        match: keyOrPattern,
        count: 100,
      });
      stream.on("data", (keys: string[]) => {
        if (keys.length) {
          const pipeline = redisClient.pipeline();
          keys.forEach((key) => {
            pipeline.del(key);
          });
          pipeline.exec();
        }
      });
      stream.on("end", () =>
        logger.info(`Cache invalidated for pattern: ${keyOrPattern}`),
      );
    } else {
      // Иначе просто удаляем по ключу
      await redisClient.del(keyOrPattern);
      logger.info(`Cache invalidated for key: ${keyOrPattern}`);
    }
  } catch (error) {
    logger.error(
      `Error invalidating cache for key ${keyOrPattern}: ${error.message}`,
    );
  }
};
