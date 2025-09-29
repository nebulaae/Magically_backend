import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: 3,
    // Добавлена стратегия переподключения
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        console.log(`Redis: Retrying connection in ${delay}ms...`);
        return delay;
    },
});

redisClient.on('connect', () => {
    console.log('Successfully connected to Redis.');
});

redisClient.on('error', (err) => {
    console.error('Redis connection error:', err.message);
});

// Проверяем, готов ли клиент к работе
const isRedisReady = () => redisClient.status === 'ready';

export const getFromCache = async <T>(key: string): Promise<T | null> => {
    if (!isRedisReady()) {
        console.warn('Redis is not ready, skipping cache GET.');
        return null;
    }
    try {
        const data = await redisClient.get(key);
        if (data) {
            return JSON.parse(data) as T;
        }
        return null;
    } catch (error) {
        console.error(`Error getting from cache for key ${key}:`, error);
        return null;
    }
};

export const setInCache = async (key: string, value: any, ttlSeconds: number = 3600): Promise<void> => {
    if (!isRedisReady()) {
        console.warn('Redis is not ready, skipping cache SET.');
        return;
    }
    try {
        const stringifiedValue = JSON.stringify(value);
        await redisClient.set(key, stringifiedValue, 'EX', ttlSeconds);
    } catch (error) {
        console.error(`Error setting cache for key ${key}:`, error);
    }
};

// Функция для удаления кеша по ключу или паттерну
export const invalidateCache = async (keyOrPattern: string): Promise<void> => {
    if (!isRedisReady()) {
        console.warn('Redis is not ready, skipping cache INVALIDATE.');
        return;
    }
    try {
        // Если это паттерн (содержит *), используем SCAN и DEL
        if (keyOrPattern.includes('*')) {
            const stream = redisClient.scanStream({
                match: keyOrPattern,
                count: 100,
            });
            stream.on('data', (keys: string[]) => {
                if (keys.length) {
                    const pipeline = redisClient.pipeline();
                    keys.forEach((key) => {
                        pipeline.del(key);
                    });
                    pipeline.exec();
                }
            });
            stream.on('end', () => console.log(`Cache invalidated for pattern: ${keyOrPattern}`));
        } else {
            // Иначе просто удаляем по ключу
            await redisClient.del(keyOrPattern);
            console.log(`Cache invalidated for key: ${keyOrPattern}`);
        }
    } catch (error) {
        console.error(`Error invalidating cache for key ${keyOrPattern}:`, error);
    }
};