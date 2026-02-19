import axios from 'axios';
import logger from '../../../shared/utils/logger';

// Функция для получения валюты по коду страны
// Доступные валюты: RUB и BYN
// Для региона BY выбираем BYN, для остальных RUB
function getCurrencyByCountry(countryCode: string): string {
  // Для Беларуси возвращаем BYN, для всех остальных регионов - RUB
  return countryCode === 'BY' ? 'BYN' : 'RUB';
}

// Получает IP адрес из запроса
export function getClientIP(req: any): string | null {
  // Проверяем различные заголовки для получения реального IP
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare

  if (forwarded) {
    // x-forwarded-for может содержать несколько IP, берем первый
    return Array.isArray(forwarded)
      ? forwarded[0].split(',')[0].trim()
      : forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Если заголовки не помогли, используем IP из соединения
  return req.ip || req.connection?.remoteAddress || null;
}

// Определяет валюту по IP адресу
export const getCurrencyByIP = async (
  ip: string | null
): Promise<{
  currency: string;
  country: string | null;
  ip: string | null;
}> => {
  // Если IP не предоставлен, возвращаем дефолтную валюту
  if (!ip) {
    return {
      currency: 'RUB',
      country: null,
      ip: null,
    };
  }

  try {
    // Используем бесплатный API ip-api.com для определения страны
    const response = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,message,countryCode`,
      {
        timeout: 5000, // 5 секунд таймаут
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (response.data.status === 'fail') {
      logger.warn(
        `Failed to get geolocation for IP ${ip}: ${response.data.message}`
      );
      return {
        currency: 'RUB',
        country: null,
        ip,
      };
    }

    const countryCode = response.data.countryCode;
    const currency = getCurrencyByCountry(countryCode);

    logger.info(
      `Currency determined for IP ${ip}: ${currency} (country: ${countryCode})`
    );

    return {
      currency,
      country: countryCode,
      ip,
    };
  } catch (error: any) {
    logger.error(`Error determining currency for IP ${ip}: ${error.message}`);
    // В случае ошибки возвращаем дефолтную валюту
    return {
      currency: 'RUB',
      country: null,
      ip,
    };
  }
};
