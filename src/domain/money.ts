import type { Cents, Currency } from './types';

const LOCALE = 'es-MX';

// Accepts "10000", "10,000.50", "$10,000.5", "10 000", "USD 10,000.50"; at most 2 decimals.
const AMOUNT_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;

/**
 * Parses a user-typed, non-negative amount into cents. Returns `null` when the text is not a
 * valid amount. Uses es-MX conventions: `,` groups thousands and `.` separates decimals.
 */
export function parseAmountToCents(input: string): Cents | null {
  const normalized = input
    .trim()
    .replace(/^(USD|MXN)\s*/i, '')
    .replace(/^\$/, '')
    .replace(/[,\s]/g, '');
  const match = AMOUNT_PATTERN.exec(normalized);
  if (!match) return null;

  const [, whole = '', fraction = ''] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function isValidCents(value: number): boolean {
  return Number.isSafeInteger(value);
}

const currencyFormatters = new Map<Currency, Intl.NumberFormat>();

/** Formats cents as currency in es-MX: MXN → "$10,000.50", USD → "USD 10,000.50". */
export function formatMoney(cents: Cents, currency: Currency): string {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(cents / 100);
}

/** Formats a ratio (0.0123) as a signed percentage ("+1.23%"). `null` renders as "—". */
export function formatPercent(rate: number | null, fractionDigits = 2): string {
  if (rate === null || !Number.isFinite(rate)) return '—';
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    signDisplay: 'exceptZero',
  }).format(rate);
}
