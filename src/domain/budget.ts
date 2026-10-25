import { buildSchedule, type Credit } from './credit';
import { isValidCents } from './money';
import {
  addMonthsToYearMonth,
  compareYearMonths,
  isYearMonth,
  toYearMonth,
  type YearMonth,
} from './months';
import { CURRENCIES, type Cents, type Currency, type DistributiveOmit } from './types';

/** Fixed list; `credit` also holds the payments of registered credits. */
export const EXPENSE_CATEGORIES = [
  'housing',
  'services',
  'food',
  'transport',
  'subscriptions',
  'health',
  'leisure',
  'small',
  'credit',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const BUDGET_NAME_MAX_LENGTH = 60;

interface BudgetItemBase {
  id: string;
  name: string;
  /** Always positive; the direction comes from `kind`. */
  amount: Cents;
  currency: Currency;
  /** The month of a one-off item, or the first month of a recurring one. */
  month: YearMonth;
  /** Repeats every month from `month` on. */
  recurring: boolean;
  /** Last month (included) of a recurring item; absent while it keeps repeating. */
  endMonth?: YearMonth;
}

export interface IncomeItem extends BudgetItemBase {
  kind: 'income';
}

export interface ExpenseItem extends BudgetItemBase {
  kind: 'expense';
  category: ExpenseCategory;
}

export type BudgetItem = IncomeItem | ExpenseItem;
export type BudgetItemDraft = DistributiveOmit<BudgetItem, 'id'>;

type Schedule = Pick<BudgetItem, 'month' | 'recurring' | 'endMonth'>;

/** Whether the item counts in `month`. */
export function isActiveIn(item: Schedule, month: YearMonth): boolean {
  if (!item.recurring) return item.month === month;
  return (
    compareYearMonths(item.month, month) <= 0 &&
    (item.endMonth === undefined || compareYearMonths(month, item.endMonth) <= 0)
  );
}

/**
 * A recurring item can be changed "from this month on" (keeping its past) only when it started
 * before `month` and still counts in it.
 */
export function canSplitAt(item: Schedule, month: YearMonth): boolean {
  return item.recurring && compareYearMonths(item.month, month) < 0 && isActiveIn(item, month);
}

/** The item as it was before `month`: it stops repeating the month before. */
export function endBefore<T extends BudgetItem>(item: T, month: YearMonth): T {
  return { ...item, endMonth: addMonthsToYearMonth(month, -1) };
}

// --- Credit payments in the budget ---

/** The payments of one credit that fall in one month (a quincenal credit pays twice). */
export interface CreditMonthPayment {
  creditId: string;
  name: string;
  currency: Currency;
  month: YearMonth;
  /** What is paid that month, IVA included. */
  amount: Cents;
  /** Payment numbers, e.g. [5, 6] = payments 5 and 6. */
  numbers: number[];
  totalPayments: number;
}

/** Every credit's payments, grouped by month. Credits are validated on write. */
export function creditMonthPayments(
  credits: readonly Pick<
    Credit,
    'id' | 'name' | 'currency' | 'annualRateBps' | 'ivaOnInterest' | 'frequency' | 'plans'
  >[],
): CreditMonthPayment[] {
  const result: CreditMonthPayment[] = [];
  for (const credit of credits) {
    const { payments } = buildSchedule(credit);
    const byMonth = new Map<YearMonth, CreditMonthPayment>();
    for (const payment of payments) {
      const month = toYearMonth(payment.date);
      let entry = byMonth.get(month);
      if (!entry) {
        entry = {
          creditId: credit.id,
          name: credit.name,
          currency: credit.currency,
          month,
          amount: 0,
          numbers: [],
          totalPayments: payments.length,
        };
        byMonth.set(month, entry);
        result.push(entry);
      }
      entry.amount += payment.total;
      entry.numbers.push(payment.number);
    }
  }
  return result;
}

// --- Month summary ---

export interface BudgetData {
  items: readonly BudgetItem[];
  creditPayments: readonly CreditMonthPayment[];
}

export interface CategoryTotal {
  category: ExpenseCategory;
  amount: Cents;
}

export interface MonthSummary {
  month: YearMonth;
  currency: Currency;
  income: Cents;
  /** Expense items plus credit payments. */
  expenses: Cents;
  /** `income − expenses`: what is left (negative when spending more than what came in). */
  left: Cents;
  /** `expenses / income`; `null` without income. */
  spentRatio: number | null;
  creditPayments: Cents;
  /** Non-zero categories, largest first. */
  byCategory: CategoryTotal[];
  incomeItems: IncomeItem[];
  expenseItems: ExpenseItem[];
  credits: CreditMonthPayment[];
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
const byAmountDesc = (a: { amount: Cents }, b: { amount: Cents }) => b.amount - a.amount;

function summarize(data: BudgetData, month: YearMonth, currency: Currency): MonthSummary {
  const items = data.items.filter((i) => i.currency === currency && isActiveIn(i, month));
  const incomeItems = items.filter((i): i is IncomeItem => i.kind === 'income').sort(byAmountDesc);
  const expenseItems = items
    .filter((i): i is ExpenseItem => i.kind === 'expense')
    .sort(byAmountDesc);
  const credits = data.creditPayments
    .filter((p) => p.currency === currency && p.month === month)
    .sort(byAmountDesc);

  const income = sum(incomeItems.map((i) => i.amount));
  const creditPayments = sum(credits.map((c) => c.amount));
  const expenses = sum(expenseItems.map((i) => i.amount)) + creditPayments;

  const totals = new Map<ExpenseCategory, Cents>();
  for (const item of expenseItems) {
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount);
  }
  if (creditPayments > 0) totals.set('credit', (totals.get('credit') ?? 0) + creditPayments);
  const byCategory = [...totals]
    .map(([category, amount]) => ({ category, amount }))
    .filter((c) => c.amount > 0)
    .sort(byAmountDesc);

  return {
    month,
    currency,
    income,
    expenses,
    left: income - expenses,
    spentRatio: income > 0 ? expenses / income : null,
    creditPayments,
    byCategory,
    incomeItems,
    expenseItems,
    credits,
  };
}

/** One summary per currency with something in `month`. Currencies are never mixed. */
export function summarizeMonth(data: BudgetData, month: YearMonth): MonthSummary[] {
  return CURRENCIES.map((currency) => summarize(data, month, currency)).filter(
    (s) => s.incomeItems.length + s.expenseItems.length + s.credits.length > 0,
  );
}

export interface MonthTotals {
  month: YearMonth;
  income: Cents;
  expenses: Cents;
  left: Cents;
}

/** Income, expenses and what was left in each of `months`, in one currency. */
export function monthlyTotals(
  data: BudgetData,
  currency: Currency,
  months: readonly YearMonth[],
): MonthTotals[] {
  return months.map((month) => {
    const { income, expenses, left } = summarize(data, month, currency);
    return { month, income, expenses, left };
  });
}

/** Earliest month with any income, expense or credit payment. */
export function firstBudgetMonth(data: BudgetData): YearMonth | null {
  const months = [...data.items.map((i) => i.month), ...data.creditPayments.map((p) => p.month)];
  return months.length === 0
    ? null
    : months.reduce((a, b) => (compareYearMonths(a, b) <= 0 ? a : b));
}

// --- Validation ---

export type BudgetIssueCode =
  | 'INVALID_NAME'
  | 'INVALID_AMOUNT'
  | 'INVALID_CURRENCY'
  | 'INVALID_MONTH'
  | 'INVALID_CATEGORY'
  | 'END_BEFORE_START'
  | 'END_WITHOUT_RECURRING';

/** Checks an item before it is stored. The UI maps each code to a text in `src/i18n`. */
export function validateBudgetItem(item: BudgetItemDraft): BudgetIssueCode[] {
  const issues: BudgetIssueCode[] = [];
  const nameLength = item.name.trim().length;
  if (nameLength === 0 || nameLength > BUDGET_NAME_MAX_LENGTH) issues.push('INVALID_NAME');
  if (!isValidCents(item.amount) || item.amount <= 0) issues.push('INVALID_AMOUNT');
  if (!CURRENCIES.includes(item.currency)) issues.push('INVALID_CURRENCY');
  if (item.kind === 'expense' && !EXPENSE_CATEGORIES.includes(item.category)) {
    issues.push('INVALID_CATEGORY');
  }
  if (!isYearMonth(item.month)) issues.push('INVALID_MONTH');
  if (item.endMonth !== undefined) {
    if (!item.recurring) issues.push('END_WITHOUT_RECURRING');
    else if (!isYearMonth(item.endMonth)) issues.push('INVALID_MONTH');
    else if (isYearMonth(item.month) && compareYearMonths(item.endMonth, item.month) < 0) {
      issues.push('END_BEFORE_START');
    }
  }
  return issues;
}
