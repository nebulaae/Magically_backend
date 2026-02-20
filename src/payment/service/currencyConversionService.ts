import axios from 'axios';
import logger from '../../../shared/utils/logger';

// Кэш курсов валют (обновляется при каждом запросе или можно добавить TTL)
let exchangeRatesCache: Record<string, number> | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 час в миллисекундах

// Статичные курсы валют к RUB (используются как fallback)
// Можно обновлять вручную или получать из API
const STATIC_EXCHANGE_RATES: Record<string, number> = {
  RUB: 1.0,
  USD: 100.0, // 1 USD = 100 RUB (примерный курс)
  EUR: 110.0, // 1 EUR = 110 RUB (примерный курс)
  BYN: 30.0, // 1 BYN = 30 RUB (примерный курс)
  KZT: 0.2, // 1 KZT = 0.2 RUB (примерный курс)
  UAH: 2.5, // 1 UAH = 2.5 RUB (примерный курс)
  GBP: 125.0, // 1 GBP = 125 RUB (примерный курс)
  PLN: 25.0, // 1 PLN = 25 RUB (примерный курс)
  TRY: 3.0, // 1 TRY = 3 RUB (примерный курс)
  CNY: 14.0, // 1 CNY = 14 RUB (примерный курс)
  JPY: 0.7, // 1 JPY = 0.7 RUB (примерный курс)
  KRW: 0.075, // 1 KRW = 0.075 RUB (примерный курс)
  INR: 1.2, // 1 INR = 1.2 RUB (примерный курс)
  BRL: 20.0, // 1 BRL = 20 RUB (примерный курс)
};

// Получает актуальные курсы валют из API (опционально)
// Можно использовать бесплатные API, например exchangerate-api.com или fixer.io
async function fetchExchangeRates(): Promise<Record<string, number> | null> {
  try {
    // Используем бесплатный API exchangerate-api.com (не требует API ключа для базового использования)
    // Альтернатива: можно использовать другие API с ключом через EXCHANGE_RATE_API_KEY
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const apiUrl = apiKey
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/RUB`
      : `https://api.exchangerate-api.com/v4/latest/RUB`;

    const response = await axios.get(apiUrl, {
      timeout: 5000,
    });

    if (response.data && response.data.rates) {
      // Конвертируем rates в формат: валюта -> RUB
      // exchangerate-api возвращает rates относительно базовой валюты (RUB)
      // Нужно инвертировать: если 1 RUB = 0.01 USD, то 1 USD = 100 RUB
      const rates: Record<string, number> = {};
      const baseRates = response.data.rates || response.data.conversion_rates;

      if (baseRates) {
        // Для каждой валюты вычисляем курс к RUB
        Object.keys(baseRates).forEach((currency) => {
          if (currency !== 'RUB' && baseRates[currency] > 0) {
            rates[currency] = 1 / baseRates[currency];
          }
        });
      }

      rates['RUB'] = 1.0; // RUB к RUB всегда 1

      return rates;
    }

    return null;
  } catch (error: any) {
    logger.warn(
      `Failed to fetch exchange rates from API: ${error.message}. Using static rates.`
    );
    return null;
  }
}

// Получает курс валюты к RUB
export async function getExchangeRateToRUB(currency: string): Promise<number> {
  const currencyUpper = currency.toUpperCase();

  // RUB всегда равен 1
  if (currencyUpper === 'RUB') {
    return 1.0;
  }

  // Проверяем кэш
  const now = Date.now();
  if (exchangeRatesCache && now - cacheTimestamp < CACHE_TTL) {
    if (exchangeRatesCache[currencyUpper]) {
      return exchangeRatesCache[currencyUpper];
    }
  }

  // Пытаемся получить актуальные курсы
  if (!exchangeRatesCache || now - cacheTimestamp >= CACHE_TTL) {
    const freshRates = await fetchExchangeRates();
    if (freshRates) {
      exchangeRatesCache = freshRates;
      cacheTimestamp = now;
    }
  }

  // Используем кэш или статичные курсы
  const rates = exchangeRatesCache || STATIC_EXCHANGE_RATES;

  if (rates[currencyUpper]) {
    return rates[currencyUpper];
  }

  // Если курс не найден, логируем предупреждение и используем дефолтный курс
  logger.warn(
    `Exchange rate for ${currencyUpper} not found, using default rate 1.0`
  );
  return 1.0;
}

// Конвертирует сумму из одной валюты в RUB
export async function convertToRUB(
  amount: number,
  fromCurrency: string
): Promise<number> {
  const rate = await getExchangeRateToRUB(fromCurrency);
  return amount * rate;
}

// Рассчитывает количество токенов на основе суммы платежа и валюты
// PAYMENT_TO_TOKENS_RATE определяет курс: 1 токен = PAYMENT_TO_TOKENS_RATE RUB
//
// Примеры:
// - PAYMENT_TO_TOKENS_RATE=1: 1 токен = 1 RUB
//   Платеж 100 RUB -> 100 токенов
//   Платеж 10 USD (курс 100 RUB/USD) -> 1000 RUB -> 1000 токенов
//
// - PAYMENT_TO_TOKENS_RATE=10: 1 токен = 10 RUB
//   Платеж 100 RUB -> 10 токенов
//   Платеж 10 USD (курс 100 RUB/USD) -> 1000 RUB -> 100 токенов
export async function calculateTokensFromPayment(
  amount: number,
  currency: string
): Promise<number> {
  // Конвертируем сумму в RUB
  const amountInRUB = await convertToRUB(amount, currency);

  // Получаем курс токенов (сколько RUB стоит 1 токен)
  // PAYMENT_TO_TOKENS_RATE=1 означает: 1 токен = 1 RUB
  const tokensRate = Number(process.env.PAYMENT_TO_TOKENS_RATE) || 1;

  // Рассчитываем количество токенов
  // Формула: токены = сумма_в_RUB / курс_токенов
  // Если tokensRate = 1, то 1 RUB = 1 токен
  // Если tokensRate = 10, то 10 RUB = 1 токен
  const tokens = amountInRUB / tokensRate;

  // Округляем вниз до целого числа токенов
  return Math.floor(tokens);
}
