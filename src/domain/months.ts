import type { IsoDate } from './types';

/** Calendar month in ISO format `YYYY-MM`. */
export type YearMonth = string;

const YEAR_MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

function parts(month: YearMonth): [number, number] {
  const match = YEAR_MONTH_PATTERN.exec(month);
  if (!match) throw new RangeError(`Invalid year-month: ${month}`);
  return [Number(match[1]), Number(match[2])];
}

/** True for `YYYY-MM` with a month from 01 to 12. */
export function isYearMonth(value: string): boolean {
  const match = YEAR_MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

/** Month of a calendar date: `2026-10-25` → `2026-10`. */
export function toYearMonth(date: IsoDate): YearMonth {
  return date.slice(0, 7);
}

export function compareYearMonths(a: YearMonth, b: YearMonth): number {
  // `YYYY-MM` sorts lexicographically.
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `month` moved by whole months (negative goes back). */
export function addMonthsToYearMonth(month: YearMonth, months: number): YearMonth {
  const [year, m] = parts(month);
  const index = year * 12 + (m - 1) + months;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${pad((index % 12) + 1)}`;
}

/** Whole months from `from` to `to` (negative when `to` is earlier). */
export function monthsBetween(from: YearMonth, to: YearMonth): number {
  const [fromYear, fromMonth] = parts(from);
  const [toYear, toMonth] = parts(to);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/** Every month from `from` to `to`, both included; empty when `to` is earlier. */
export function monthRange(from: YearMonth, to: YearMonth): YearMonth[] {
  const count = monthsBetween(from, to) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, i) => addMonthsToYearMonth(from, i));
}
