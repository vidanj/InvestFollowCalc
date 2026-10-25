import {
  BUDGET_NAME_MAX_LENGTH,
  startingIn,
  validateBudgetItem,
  type BudgetItem,
  type BudgetItemDraft,
  type ExpenseCategory,
  type Repeat,
} from '../../domain/budget';
import { isIsoDate } from '../../domain/dates';
import { formatAmountInput, parseAmountToCents } from '../../domain/money';
import { compareYearMonths, isYearMonth, toYearMonth, type YearMonth } from '../../domain/months';
import type { Currency, IsoDate } from '../../domain/types';
import { strings } from '../../i18n/es-MX';

export type BudgetKind = BudgetItem['kind'];

export interface BudgetItemFormValues {
  kind: BudgetKind;
  name: string;
  amount: string;
  currency: Currency;
  category: ExpenseCategory;
  repeat: Repeat;
  /** First month (one-off, monthly and yearly items). */
  month: YearMonth;
  /** First charge (weekly items). */
  firstDate: string;
  hasEnd: boolean;
  endMonth: YearMonth;
}

export interface BudgetItemFormErrors {
  name?: string;
  amount?: string;
  firstDate?: string;
  endMonth?: string;
  /** Anything the domain still rejects. */
  other?: string[];
}

export type ParsedBudgetItem =
  { ok: true; draft: BudgetItemDraft } | { ok: false; errors: BudgetItemFormErrors };

/** A new item in `month`; a weekly one starts today when `month` is the current one. */
export function emptyBudgetItemValues(
  kind: BudgetKind,
  month: YearMonth,
  today: IsoDate,
): BudgetItemFormValues {
  return {
    kind,
    name: '',
    amount: '',
    currency: 'MXN',
    category: 'other',
    // Income usually repeats (salary); a new expense is often a one-off.
    repeat: kind === 'income' ? 'monthly' : 'none',
    month,
    firstDate: toYearMonth(today) === month ? today : `${month}-01`,
    hasEnd: false,
    endMonth: month,
  };
}

export function valuesFromItem(item: BudgetItem): BudgetItemFormValues {
  return {
    kind: item.kind,
    name: item.name,
    amount: formatAmountInput(item.amount),
    currency: item.currency,
    category: item.kind === 'expense' ? item.category : 'other',
    repeat: item.repeat,
    month: item.month,
    firstDate: item.firstDate ?? `${item.month}-01`,
    hasEnd: item.endMonth !== undefined,
    endMonth: item.endMonth ?? item.month,
  };
}

/**
 * Turns form text into an item draft, or field errors. With `fromMonth` (a change "from this
 * month on"), the draft starts in that month, keeping a weekly item's weekday.
 */
export function parseBudgetItemForm(
  values: BudgetItemFormValues,
  fromMonth?: YearMonth,
): ParsedBudgetItem {
  const errors: BudgetItemFormErrors = {};
  const nameLength = values.name.trim().length;
  if (nameLength === 0 || nameLength > BUDGET_NAME_MAX_LENGTH) {
    errors.name = strings.errors.nameLength(BUDGET_NAME_MAX_LENGTH);
  }

  const amount = parseAmountToCents(values.amount);
  if (values.amount.trim() === '') errors.amount = strings.errors.required;
  else if (amount === null || amount <= 0) errors.amount = strings.errors.invalidAmount;

  const weekly = values.repeat === 'weekly';
  if (weekly && !isIsoDate(values.firstDate)) errors.firstDate = strings.errors.invalidDate;
  const month =
    weekly && isIsoDate(values.firstDate) ? toYearMonth(values.firstDate) : values.month;
  const start = fromMonth ?? month;

  const withEnd = values.repeat !== 'none' && values.hasEnd;
  if (
    withEnd &&
    isYearMonth(values.endMonth) &&
    isYearMonth(start) &&
    compareYearMonths(values.endMonth, start) < 0
  ) {
    errors.endMonth = strings.errors.budgetIssue('END_BEFORE_START');
  }
  if (Object.keys(errors).length > 0 || amount === null) return { ok: false, errors };

  const base = {
    name: values.name.trim(),
    amount,
    currency: values.currency,
    month,
    repeat: values.repeat,
    ...(weekly ? { firstDate: values.firstDate } : {}),
    ...(withEnd ? { endMonth: values.endMonth } : {}),
  };
  const parsed: BudgetItemDraft =
    values.kind === 'income'
      ? { ...base, kind: 'income' }
      : { ...base, kind: 'expense', category: values.category };
  const draft = fromMonth === undefined ? parsed : startingIn(parsed, fromMonth);

  const issues = validateBudgetItem(draft);
  if (issues.length > 0) {
    return { ok: false, errors: { other: issues.map((code) => strings.errors.budgetIssue(code)) } };
  }
  return { ok: true, draft };
}
