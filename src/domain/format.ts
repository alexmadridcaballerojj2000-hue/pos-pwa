import type { Minor, Milli } from './index';

export interface CurrencyConfig {
  code: string;
  decimals: number;
  symbol?: string;
}

/**
 * Format minor unit integer (e.g. cents) to localized currency string.
 * Uses Intl.NumberFormat according to SPEC §10.
 *
 * @param amountMinor - Integer in minor units (e.g. 1050 for 10.50)
 * @param currency - Currency configuration from Settings
 * @param locale - BCP 47 locale (defaults to 'es-ES')
 */
export function formatMoney(
  amountMinor: Minor,
  currency: CurrencyConfig,
  locale = 'es-ES',
): string {
  const divisor = Math.pow(10, currency.decimals);
  const majorAmount = amountMinor / divisor;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    }).format(majorAmount);
  } catch {
    // Fallback if currency code is custom or non-standard ISO
    const formattedNumber = new Intl.NumberFormat(locale, {
      minimumFractionDigits: currency.decimals,
      maximumFractionDigits: currency.decimals,
    }).format(majorAmount);

    return currency.symbol
      ? `${currency.symbol} ${formattedNumber}`
      : `${currency.code} ${formattedNumber}`;
  }
}

/**
 * Format milli unit integer (1 unit = 1000) to localized quantity string.
 *
 * @param qtyMilli - Quantity in milli units
 * @param unit - Optional unit label (e.g. 'kg', 'unit')
 * @param locale - BCP 47 locale
 */
export function formatQuantity(qtyMilli: Milli, unit?: string, locale = 'es-ES'): string {
  const decimalQty = qtyMilli / 1000;
  const isInteger = qtyMilli % 1000 === 0;

  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: isInteger ? 0 : 1,
    maximumFractionDigits: 3,
  }).format(decimalQty);

  return unit ? `${formattedNumber} ${unit}` : formattedNumber;
}
