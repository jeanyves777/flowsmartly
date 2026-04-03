/**
 * Shared currency formatting utilities for FlowShop.
 *
 * ONE source of truth — every page should import from here
 * instead of reimplementing Intl.NumberFormat inline.
 */

// ── Currency → Locale mapping ─────────────────────────────────────────
// Maps ISO 4217 currency codes to the most appropriate locale so that
// the formatting matches local conventions (symbol placement, decimal
// separator, grouping).
const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  CAD: "en-CA",
  GBP: "en-GB",
  EUR: "fr-FR",     // 1 234,56 €
  XOF: "fr-SN",     // CFA — Senegal
  XAF: "fr-CM",     // CFA — Cameroon
  NGN: "en-NG",     // Nigerian Naira
  KES: "en-KE",     // Kenyan Shilling
  ZAR: "en-ZA",     // South African Rand
  GHS: "en-GH",     // Ghanaian Cedi
  AED: "ar-AE",     // UAE Dirham
  SAR: "ar-SA",     // Saudi Riyal
  INR: "en-IN",     // Indian Rupee (lakh/crore grouping)
  JPY: "ja-JP",     // Japanese Yen (0 decimals)
  CNY: "zh-CN",     // Chinese Yuan
  KRW: "ko-KR",     // Korean Won (0 decimals)
  BRL: "pt-BR",     // Brazilian Real
  MXN: "es-MX",     // Mexican Peso
  ARS: "es-AR",     // Argentine Peso
  COP: "es-CO",     // Colombian Peso
  CLP: "es-CL",     // Chilean Peso
  PEN: "es-PE",     // Peruvian Sol
  AUD: "en-AU",
  NZD: "en-NZ",
  SGD: "en-SG",
  HKD: "zh-HK",
  TWD: "zh-TW",
  THB: "th-TH",
  PHP: "en-PH",
  IDR: "id-ID",
  MYR: "ms-MY",
  VND: "vi-VN",
  TRY: "tr-TR",
  PLN: "pl-PL",
  CZK: "cs-CZ",
  SEK: "sv-SE",
  NOK: "nb-NO",
  DKK: "da-DK",
  CHF: "de-CH",
  RUB: "ru-RU",
  UAH: "uk-UA",
  EGP: "ar-EG",
  MAD: "ar-MA",
  TZS: "sw-TZ",
  UGX: "en-UG",
  RWF: "rw-RW",
  ETB: "am-ET",
};

// Currencies that have no minor unit (0 decimal places)
const ZERO_DECIMAL_CURRENCIES = new Set([
  "JPY", "KRW", "VND", "CLP", "UGX", "RWF", "XOF", "XAF",
  "BIF", "DJF", "GNF", "KMF", "MGA", "PYG", "ISK", "HUF",
]);

/**
 * Get the best locale for a given ISO 4217 currency code.
 */
export function getLocaleForCurrency(currency: string): string {
  return CURRENCY_LOCALE[currency.toUpperCase()] || "en-US";
}

/**
 * Check if a currency uses zero-decimal (i.e. no minor unit).
 * For these, 1000 means 1000 yen — NOT 10.00.
 */
export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
}

/**
 * Format a cent-based integer amount into a localised currency string.
 *
 * @param cents    Amount in the smallest unit (e.g. 1999 = $19.99 for USD, or ¥1999 for JPY)
 * @param currency ISO 4217 code (default "USD")
 * @param locale   Override locale (if omitted, derived from currency)
 *
 * For zero-decimal currencies the value is used as-is (no ÷100).
 */
export function formatPrice(
  cents: number,
  currency: string = "USD",
  locale?: string,
): string {
  const cur = currency.toUpperCase();
  const loc = locale || getLocaleForCurrency(cur);
  const isZero = isZeroDecimalCurrency(cur);

  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency: cur,
    minimumFractionDigits: isZero ? 0 : 2,
    maximumFractionDigits: isZero ? 0 : 2,
  }).format(isZero ? cents : cents / 100);
}

/**
 * Alias kept for backward compatibility with existing cart.ts callers.
 */
export const formatCents = formatPrice;

/**
 * Convert a user-typed "dollar" string to cents.
 * Handles zero-decimal currencies (JPY → input IS the value, no *100).
 */
export function toCents(value: string, currency: string = "USD"): number {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return 0;
  if (isZeroDecimalCurrency(currency)) return Math.round(num);
  return Math.round(num * 100);
}

/**
 * Convert a cent value back to a display string suitable for a form input.
 */
export function fromCents(cents: number, currency: string = "USD"): string {
  if (isZeroDecimalCurrency(currency)) return String(cents);
  return (cents / 100).toFixed(2);
}

/**
 * Supported ISO 4217 codes (for validation in settings).
 */
export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_LOCALE);

/**
 * Validate an ISO 4217 currency code against our supported list.
 */
export function isValidCurrency(code: string): boolean {
  return SUPPORTED_CURRENCIES.includes(code.toUpperCase());
}
