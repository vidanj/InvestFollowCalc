import {
  BUDGET_NAME_MAX_LENGTH,
  validateBudgetItem,
  type BudgetItem,
  type BudgetItemDraft,
  type ExpenseCategory,
} from '../../domain/budget';
import { formatAmountInput, parseAmountToCents } from '../../domain/money';
import { compareYearMonths, isYearMonth, type YearMonth } from '../../domain/months';
import type { Currency } from '../../domain/types';
import { strings } from '../../i18n/es-MX';

export type BudgetKind = BudgetItem['kind'];

export interface BudgetItemFormValues {
  kind: BudgetKind;
  name: string;
  amount: string;
  currency: Currency;
  category: ExpenseCategory;
  recurring: boolean;
  month: YearMonth;
  hasEnd: boolean;
  endMonth: YearMonth;
}

export interface BudgetItemFormErrors {
  name?: string;
  amount?: string;
  endMonth?: string;
  /** Anything the domain still rejects. */
  other?: string[];
}

export type ParsedBudgetItem =
  { ok: true; draft: BudgetItemDraft } | { ok: false; errors: BudgetItemFormErrors };

export function emptyBudgetItemValues(kind: BudgetKind, month: YearMonth): BudgetItemFormValues {
  return {
    kind,
    name: '',
    amount: '',
    currency: 'MXN',
    category: 'other',
    // Income usually repeats (salary); a new expense is often a one-off.
    recurring: kind === 'income',
    month,
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
    recurring: item.recurring,
    month: item.month,
    hasEnd: item.endMonth !== undefined,
    endMonth: item.endMonth ?? item.month,
  };
}

/** Turns form text into an item draft, or field errors. */
export function parseBudgetItemForm(values: BudgetItemFormValues): ParsedBudgetItem {
  const errors: BudgetItemFormErrors = {};
  const nameLength = values.name.trim().length;
  if (nameLength === 0 || nameLength > BUDGET_NAME_MAX_LENGTH) {
    errors.name = strings.errors.nameLength(BUDGET_NAME_MAX_LENGTH);
  }

  const amount = parseAmountToCents(values.amount);
  if (values.amount.trim() === '') errors.amount = strings.errors.required;
  else if (amount === null || amount <= 0) errors.amount = strings.errors.invalidAmount;

  const withEnd = values.recurring && values.hasEnd;
  if (
    withEnd &&
    isYearMonth(values.endMonth) &&
    isYearMonth(values.month) &&
    compareYearMonths(values.endMonth, values.month) < 0
  ) {
    errors.endMonth = strings.errors.budgetIssue('END_BEFORE_START');
  }
  if (errors.name || errors.amount || errors.endMonth || amount === null) {
    return { ok: false, errors };
  }

  const base = {
    name: values.name.trim(),
    amount,
    currency: values.currency,
    month: values.month,
    recurring: values.recurring,
    ...(withEnd ? { endMonth: values.endMonth } : {}),
  };
  const draft: BudgetItemDraft =
    values.kind === 'income'
      ? { ...base, kind: 'income' }
      : { ...base, kind: 'expense', category: values.category };

  const issues = validateBudgetItem(draft);
  if (issues.length > 0) {
    return { ok: false, errors: { other: issues.map((code) => strings.errors.budgetIssue(code)) } };
  }
  return { ok: true, draft };
}
