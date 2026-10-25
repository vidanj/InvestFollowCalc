import { describe, expect, it } from 'vitest';
import {
  addMonthsToYearMonth,
  compareYearMonths,
  isYearMonth,
  monthRange,
  monthsBetween,
  toYearMonth,
} from '../months';

describe('isYearMonth', () => {
  it('accepts real months', () => {
    expect(isYearMonth('2026-10')).toBe(true);
    expect(isYearMonth('2026-01')).toBe(true);
    expect(isYearMonth('2026-12')).toBe(true);
  });

  it('rejects malformed months', () => {
    for (const value of ['2026-00', '2026-13', '2026-1', '2026/10', '2026-10-01', '', 'oct']) {
      expect(isYearMonth(value), value).toBe(false);
    }
  });
});

describe('month arithmetic', () => {
  it('takes the month of a date', () => {
    expect(toYearMonth('2026-10-25')).toBe('2026-10');
  });

  it('moves across year boundaries both ways', () => {
    expect(addMonthsToYearMonth('2026-10', 3)).toBe('2027-01');
    expect(addMonthsToYearMonth('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToYearMonth('2026-05', -17)).toBe('2024-12');
    expect(addMonthsToYearMonth('2026-05', 0)).toBe('2026-05');
  });

  it('rejects invalid input', () => {
    expect(() => addMonthsToYearMonth('2026-5', 1)).toThrow(RangeError);
  });

  it('counts and lists months', () => {
    expect(monthsBetween('2026-10', '2027-02')).toBe(4);
    expect(monthsBetween('2027-02', '2026-10')).toBe(-4);
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(monthRange('2026-11', '2026-11')).toEqual(['2026-11']);
    expect(monthRange('2026-11', '2026-10')).toEqual([]);
  });

  it('compares months', () => {
    expect(compareYearMonths('2026-09', '2026-10')).toBe(-1);
    expect(compareYearMonths('2026-10', '2026-10')).toBe(0);
    expect(compareYearMonths('2027-01', '2026-12')).toBe(1);
  });
});
