import type { MonthTotals } from '../../domain/budget';
import { compareYearMonths, type YearMonth } from '../../domain/months';
import { formatMonth, formatShortMonth, strings } from '../../i18n/es-MX';

export interface MonthRow extends MonthTotals {
  /** Axis label: "oct 26". */
  label: string;
  /** After the current month: only recurring items and scheduled credit payments. */
  projected: boolean;
}

export function toMonthRows(totals: readonly MonthTotals[], currentMonth: YearMonth): MonthRow[] {
  return totals.map((m) => ({
    ...m,
    label: formatShortMonth(m.month),
    projected: compareYearMonths(m.month, currentMonth) > 0,
  }));
}

/** "octubre de 2026 (proyección)". */
export function monthTitle(row: Pick<MonthRow, 'month' | 'projected'>): string {
  return `${formatMonth(row.month)}${row.projected ? ` ${strings.budget.projected}` : ''}`;
}
