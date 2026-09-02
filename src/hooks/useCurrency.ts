import { useState, useEffect, useCallback } from 'react';

interface CurrencyInfo {
  code: string;
  symbol: string;
  locale: string;
}

interface ExchangeRates {
  [key: string]: number;
}

// Default rates (fallback when API fails)
const DEFAULT_RATES: ExchangeRates = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.12,
  JPY: 149.50,
  AUD: 1.53,
  CAD: 1.36,
  CHF: 0.88,
  CNY: 7.24,
  MXN: 17.15,
  BRL: 4.97,
  KRW: 1320.50,
  SGD: 1.34,
  HKD: 7.82,
  NOK: 10.65,
  SEK: 10.42,
  DKK: 6.87,
  NZD: 1.64,
  ZAR: 18.95,
  RUB: 91.50,
  TRY: 28.85,
  PLN: 4.02,
  THB: 35.45,
  IDR: 15650,
  MYR: 4.72,
  PHP: 56.20,
  CZK: 22.75,
  ILS: 3.75,
  CLP: 885,
  PKR: 285,
  EGP: 30.90,
  VND: 24385,
  BDT: 110,
  AED: 3.67,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.31,
  NGN: 780,
  ARS: 350,
  COP: 4025,
  PEN: 3.78,
  UAH: 37.50,
  RON: 4.57,
  HUF: 356,
  BGN: 1.80,
  HRK: 6.92,
  ISK: 137,
};

// Currency info by country code
const CURRENCY_MAP: Record<string, CurrencyInfo> = {
  US: { code: 'USD', symbol: '$', locale: 'en-US' },
  GB: { code: 'GBP', symbol: '£', locale: 'en-GB' },
  EU: { code: 'EUR', symbol: '€', locale: 'de-DE' },
  IN: { code: 'INR', symbol: '₹', locale: 'en-IN' },
  JP: { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
  CN: { code: 'CNY', symbol: '¥', locale: 'zh-CN' },
  AU: { code: 'AUD', symbol: 'A$', locale: 'en-AU' },
  CA: { code: 'CAD', symbol: 'C$', locale: 'en-CA' },
  CH: { code: 'CHF', symbol: 'CHF', locale: 'de-CH' },
  MX: { code: 'MXN', symbol: '$', locale: 'es-MX' },
  BR: { code: 'BRL', symbol: 'R$', locale: 'pt-BR' },
  KR: { code: 'KRW', symbol: '₩', locale: 'ko-KR' },
  SG: { code: 'SGD', symbol: 'S$', locale: 'en-SG' },
  HK: { code: 'HKD', symbol: 'HK$', locale: 'en-HK' },
  NO: { code: 'NOK', symbol: 'kr', locale: 'nb-NO' },
  SE: { code: 'SEK', symbol: 'kr', locale: 'sv-SE' },
  DK: { code: 'DKK', symbol: 'kr', locale: 'da-DK' },
  NZ: { code: 'NZD', symbol: 'NZ$', locale: 'en-NZ' },
  ZA: { code: 'ZAR', symbol: 'R', locale: 'en-ZA' },
  RU: { code: 'RUB', symbol: '₽', locale: 'ru-RU' },
  TR: { code: 'TRY', symbol: '₺', locale: 'tr-TR' },
  PL: { code: 'PLN', symbol: 'zł', locale: 'pl-PL' },
  TH: { code: 'THB', symbol: '฿', locale: 'th-TH' },
  ID: { code: 'IDR', symbol: 'Rp', locale: 'id-ID' },
  MY: { code: 'MYR', symbol: 'RM', locale: 'ms-MY' },
  PH: { code: 'PHP', symbol: '₱', locale: 'en-PH' },
  CZ: { code: 'CZK', symbol: 'Kč', locale: 'cs-CZ' },
  IL: { code: 'ILS', symbol: '₪', locale: 'he-IL' },
  CL: { code: 'CLP', symbol: '$', locale: 'es-CL' },
  PK: { code: 'PKR', symbol: '₨', locale: 'ur-PK' },
  EG: { code: 'EGP', symbol: 'E£', locale: 'ar-EG' },
  VN: { code: 'VND', symbol: '₫', locale: 'vi-VN' },
  BD: { code: 'BDT', symbol: '৳', locale: 'bn-BD' },
  AE: { code: 'AED', symbol: 'د.إ', locale: 'ar-AE' },
  SA: { code: 'SAR', symbol: '﷼', locale: 'ar-SA' },
  QA: { code: 'QAR', symbol: 'ر.ق', locale: 'ar-QA' },
  KW: { code: 'KWD', symbol: 'د.ك', locale: 'ar-KW' },
  NG: { code: 'NGN', symbol: '₦', locale: 'en-NG' },
  AR: { code: 'ARS', symbol: '$', locale: 'es-AR' },
  CO: { code: 'COP', symbol: '$', locale: 'es-CO' },
  PE: { code: 'PEN', symbol: 'S/', locale: 'es-PE' },
  UA: { code: 'UAH', symbol: '₴', locale: 'uk-UA' },
  RO: { code: 'RON', symbol: 'lei', locale: 'ro-RO' },
  HU: { code: 'HUF', symbol: 'Ft', locale: 'hu-HU' },
  // European countries using EUR
  DE: { code: 'EUR', symbol: '€', locale: 'de-DE' },
  FR: { code: 'EUR', symbol: '€', locale: 'fr-FR' },
  IT: { code: 'EUR', symbol: '€', locale: 'it-IT' },
  ES: { code: 'EUR', symbol: '€', locale: 'es-ES' },
  NL: { code: 'EUR', symbol: '€', locale: 'nl-NL' },
  BE: { code: 'EUR', symbol: '€', locale: 'nl-BE' },
  AT: { code: 'EUR', symbol: '€', locale: 'de-AT' },
  PT: { code: 'EUR', symbol: '€', locale: 'pt-PT' },
  IE: { code: 'EUR', symbol: '€', locale: 'en-IE' },
  FI: { code: 'EUR', symbol: '€', locale: 'fi-FI' },
  GR: { code: 'EUR', symbol: '€', locale: 'el-GR' },
};

// Base currency for stored prices (all prices stored in INR)
const BASE_CURRENCY = 'INR';

export function useCurrency() {
  const [userCurrency, setUserCurrency] = useState<CurrencyInfo>({
    code: 'INR',
    symbol: '₹',
    locale: 'en-IN',
  });
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_RATES);
  const [isLoading, setIsLoading] = useState(false);

  // No conversion needed - all prices stored and displayed in INR
  const convertPrice = useCallback((priceInBase: number): number => {
    return priceInBase;
  }, []);

  // Format price with currency symbol
  const formatCurrency = useCallback((priceInBase: number): string => {
    const convertedPrice = convertPrice(priceInBase);
    
    try {
      return new Intl.NumberFormat(userCurrency.locale, {
        style: 'currency',
        currency: userCurrency.code,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(convertedPrice);
    } catch {
      // Fallback formatting
      return `${userCurrency.symbol}${convertedPrice.toFixed(2)}`;
    }
  }, [convertPrice, userCurrency]);

  // Format price without conversion (for display in base currency)
  const formatBaseCurrency = useCallback((price: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(price);
  }, []);

  return {
    userCurrency,
    exchangeRates,
    isLoading,
    formatCurrency,
    formatBaseCurrency,
    convertPrice,
    setUserCurrency,
  };
}

// Helper function to get country code from timezone
function getCountryFromTimezone(timezone: string): string | null {
  const timezoneCountryMap: Record<string, string> = {
    'America/New_York': 'US',
    'America/Los_Angeles': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Phoenix': 'US',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'America/Mexico_City': 'MX',
    'America/Sao_Paulo': 'BR',
    'America/Argentina/Buenos_Aires': 'AR',
    'America/Bogota': 'CO',
    'America/Lima': 'PE',
    'America/Santiago': 'CL',
    'Europe/London': 'GB',
    'Europe/Paris': 'FR',
    'Europe/Berlin': 'DE',
    'Europe/Rome': 'IT',
    'Europe/Madrid': 'ES',
    'Europe/Amsterdam': 'NL',
    'Europe/Brussels': 'BE',
    'Europe/Vienna': 'AT',
    'Europe/Lisbon': 'PT',
    'Europe/Dublin': 'IE',
    'Europe/Helsinki': 'FI',
    'Europe/Athens': 'GR',
    'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO',
    'Europe/Copenhagen': 'DK',
    'Europe/Zurich': 'CH',
    'Europe/Warsaw': 'PL',
    'Europe/Prague': 'CZ',
    'Europe/Budapest': 'HU',
    'Europe/Bucharest': 'RO',
    'Europe/Moscow': 'RU',
    'Europe/Kiev': 'UA',
    'Europe/Istanbul': 'TR',
    'Asia/Kolkata': 'IN',
    'Asia/Mumbai': 'IN',
    'Asia/Tokyo': 'JP',
    'Asia/Shanghai': 'CN',
    'Asia/Hong_Kong': 'HK',
    'Asia/Singapore': 'SG',
    'Asia/Seoul': 'KR',
    'Asia/Bangkok': 'TH',
    'Asia/Jakarta': 'ID',
    'Asia/Kuala_Lumpur': 'MY',
    'Asia/Manila': 'PH',
    'Asia/Ho_Chi_Minh': 'VN',
    'Asia/Dhaka': 'BD',
    'Asia/Karachi': 'PK',
    'Asia/Dubai': 'AE',
    'Asia/Riyadh': 'SA',
    'Asia/Qatar': 'QA',
    'Asia/Kuwait': 'KW',
    'Asia/Jerusalem': 'IL',
    'Africa/Cairo': 'EG',
    'Africa/Lagos': 'NG',
    'Africa/Johannesburg': 'ZA',
    'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU',
    'Australia/Brisbane': 'AU',
    'Australia/Perth': 'AU',
    'Pacific/Auckland': 'NZ',
  };

  return timezoneCountryMap[timezone] || null;
}
