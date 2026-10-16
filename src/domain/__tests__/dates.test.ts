import { describe, expect, it } from 'vitest';
import { compareIsoDates, daysBetween, isIsoDate } from '../dates';

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2026-10-16')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
  });

  it('rejects malformed or impossible dates', () => {
    for (const value of ['2026-02-29', '2026-13-01', '2026-1-01', '2026/01/01', '', 'hoy']) {
      expect(isIsoDate(value), value).toBe(false);
    }
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2026-10-01', '2026-10-12')).toBe(11);
    expect(daysBetween('2026-12-25', '2027-01-05')).toBe(11);
    expect(daysBetween('2026-10-12', '2026-10-01')).toBe(-11);
    expect(daysBetween('2026-10-01', '2026-10-01')).toBe(0);
  });

  it('is not affected by daylight saving changes', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });

  it('throws on malformed dates', () => {
    expect(() => daysBetween('2026-10-01', 'nope')).toThrow(RangeError);
  });
});

describe('compareIsoDates', () => {
  it('orders dates chronologically', () => {
    expect(compareIsoDates('2026-01-01', '2026-01-02')).toBe(-1);
    expect(compareIsoDates('2026-01-02', '2026-01-01')).toBe(1);
    expect(compareIsoDates('2026-01-01', '2026-01-01')).toBe(0);
  });
});
