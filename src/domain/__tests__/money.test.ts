import { describe, expect, it } from 'vitest';
import { formatMoney, formatPercent, isValidCents, parseAmountToCents } from '../money';

describe('parseAmountToCents', () => {
  it.each([
    ['10000', 1_000_000],
    ['10,000.50', 1_000_050],
    ['$10,000.5', 1_000_050],
    [' 10 000 ', 1_000_000],
    ['USD 1,234.56', 123_456],
    ['mxn 5', 500],
    ['0', 0],
    ['0.01', 1],
  ])('parses %j as %i cents', (input, expected) => {
    expect(parseAmountToCents(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '.5', '1e3', '999999999999999999'])('rejects %j', (input) => {
    expect(parseAmountToCents(input)).toBeNull();
  });
});

describe('isValidCents', () => {
  it('only accepts safe integers', () => {
    expect(isValidCents(100)).toBe(true);
    expect(isValidCents(-100)).toBe(true);
    expect(isValidCents(1.5)).toBe(false);
    expect(isValidCents(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });
});

describe('formatMoney', () => {
  it('formats MXN and USD so they cannot be confused', () => {
    expect(formatMoney(1_000_050, 'MXN')).toBe('$10,000.50');
    expect(formatMoney(1_000_050, 'USD')).toMatch(/^USD\s10,000\.50$/);
    expect(formatMoney(-1_250, 'MXN')).toBe('-$12.50');
  });
});

describe('formatPercent', () => {
  it('formats ratios as signed percentages', () => {
    expect(formatPercent(50 / 10_500)).toBe('+0.48%');
    expect(formatPercent(-0.05)).toBe('-5.00%');
    expect(formatPercent(0)).toBe('0.00%');
    expect(formatPercent(0.123456, 3)).toBe('+12.346%');
  });

  it('renders missing values as a dash', () => {
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(Number.NaN)).toBe('—');
    expect(formatPercent(Number.POSITIVE_INFINITY)).toBe('—');
  });
});
