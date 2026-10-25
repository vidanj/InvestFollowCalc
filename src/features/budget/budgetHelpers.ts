import { creditMonthPayments, type BudgetData } from '../../domain/budget';
import type { Credit } from '../../domain/credit';
import { isYearMonth, type YearMonth } from '../../domain/months';
import type { BudgetItemRecord } from '../../db/schema';

/** The month in the URL (`?month=2026-10`), or `fallback` when missing or invalid. */
export function monthParam(value: string | null, fallback: YearMonth): YearMonth {
  return value !== null && isYearMonth(value) ? value : fallback;
}

export function budgetPath(month: YearMonth): string {
  return `/budget?month=${month}`;
}

/**
 * Stored credits are validated on every write, so this only fails if the database was corrupted
 * from outside the app. The UI shows a message instead of crashing.
 */
export function budgetDataSafely(
  items: readonly BudgetItemRecord[],
  credits: readonly Credit[],
): BudgetData | null {
  try {
    return { items, creditPayments: creditMonthPayments(credits) };
  } catch {
    return null;
  }
}
