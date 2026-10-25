import { buildSchedule, type Credit } from './credit';
import { addDays, addMonths, compareIsoDates, daysBetween, isIsoDate } from './dates';
import { isValidCents } from './money';
import {
  addMonthsToYearMonth,
  compareYearMonths,
  isYearMonth,
  monthRange,
  monthsBetween,
  toYearMonth,
  type YearMonth,
} from './months';
import {
  CURRENCIES,
  type Cents,
  type Currency,
  type DistributiveOmit,
  type IsoDate,
} from './types';

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

/** How often an item comes back: never, every 7 days, every month or every year. */
export const REPEATS = ['none', 'weekly', 'monthly', 'yearly'] as const;
export type Repeat = (typeof REPEATS)[number];

interface BudgetItemBase {
  id: string;
  name: string;
  /** Always positive; the direction comes from `kind`. */
  amount: Cents;
  currency: Currency;
  /** The month of a one-off item, or the first month of a repeating one. */
  month: YearMonth;
  repeat: Repeat;
  /** Weekly items only: date of the first charge (inside `month`); it repeats every 7 days. */
  firstDate?: IsoDate;
  /** Last month (included) of a repeating item; absent while it keeps repeating. */
  endMonth?: YearMonth;
  /**
   * Monthly or weekly expenses only: months the user decided not to pay (e.g. a subscription
   * paused for a month). They count 0 that month and come back the next.
   */
  skippedMonths?: YearMonth[];
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

type Schedule = Pick<BudgetItem, 'month' | 'repeat' | 'firstDate' | 'endMonth'>;
type Skippable = Schedule & Pick<BudgetItem, 'kind' | 'skippedMonths'>;

function lastDayOf(month: YearMonth): IsoDate {
  return addDays(addMonths(`${month}-01`, 1), -1);
}

/** First date on or after `from` that falls on the 7-day cadence started at `first`. */
function nextWeekly(first: IsoDate, from: IsoDate): IsoDate {
  const gap = daysBetween(first, from);
  return gap <= 0 ? first : addDays(first, Math.ceil(gap / 7) * 7);
}

/**
 * How many times the item is due in `month` by its schedule: once for one-offs in their month,
 * monthly items every month, yearly items in their month every 12 months, and weekly items the
 * real number of times their 7-day cadence lands in the month (4 or 5).
 */
export function scheduledIn(item: Schedule, month: YearMonth): number {
  if (compareYearMonths(month, item.month) < 0) return 0;
  if (item.repeat === 'none') return month === item.month ? 1 : 0;
  if (item.endMonth !== undefined && compareYearMonths(month, item.endMonth) > 0) return 0;
  switch (item.repeat) {
    case 'monthly':
      return 1;
    case 'yearly':
      return monthsBetween(item.month, month) % 12 === 0 ? 1 : 0;
    case 'weekly': {
      if (item.firstDate === undefined) return 0;
      const first = nextWeekly(item.firstDate, `${month}-01`);
      const last = lastDayOf(month);
      return compareIsoDates(first, last) > 0 ? 0 : 1 + Math.floor(daysBetween(first, last) / 7);
    }
  }
}

/** Only monthly and weekly expenses can skip a month. */
export function canSkip(item: Pick<BudgetItem, 'kind' | 'repeat'>): boolean {
  return item.kind === 'expense' && (item.repeat === 'monthly' || item.repeat === 'weekly');
}

/** The user decided not to pay this item in `month`. */
export function isSkippedIn(item: Skippable, month: YearMonth): boolean {
  return canSkip(item) && (item.skippedMonths?.includes(month) ?? false);
}

/** How many times the item really counts in `month`: its schedule, or 0 in a skipped month. */
export function occurrencesIn(item: Skippable, month: YearMonth): number {
  return isSkippedIn(item, month) ? 0 : scheduledIn(item, month);
}

/** Whether the item is due in `month` (skipped or not): it is listed there. */
export function isActiveIn(item: Schedule, month: YearMonth): boolean {
  return scheduledIn(item, month) > 0;
}

/** `months` with `month` added (`skip`) or removed, sorted; `undefined` when none remain. */
export function withSkipped(
  months: readonly YearMonth[] | undefined,
  month: YearMonth,
  skip: boolean,
): YearMonth[] | undefined {
  const next = [
    ...new Set([...(months ?? []).filter((m) => m !== month), ...(skip ? [month] : [])]),
  ].sort(compareYearMonths);
  return next.length > 0 ? next : undefined;
}

/** `item` keeping only the skipped months that pass `keep`. */
function filterSkipped<T extends Pick<BudgetItem, 'skippedMonths'>>(
  item: T,
  keep: (month: YearMonth) => boolean,
): T {
  const { skippedMonths, ...rest } = item;
  const kept = skippedMonths?.filter(keep) ?? [];
  return (kept.length > 0 ? { ...rest, skippedMonths: kept } : rest) as T;
}

/**
 * A repeating item can be changed "from this month on" (keeping its past) only when it started
 * before `month` and counts in it.
 */
export function canSplitAt(item: Schedule, month: YearMonth): boolean {
  return (
    item.repeat !== 'none' && compareYearMonths(item.month, month) < 0 && isActiveIn(item, month)
  );
}

/** The item as it was before `month`: it stops repeating the month before. */
export function endBefore<T extends BudgetItem>(item: T, month: YearMonth): T {
  const ended = filterSkipped(item, (m) => compareYearMonths(m, month) < 0);
  return { ...ended, endMonth: addMonthsToYearMonth(month, -1) };
}

/**
 * `draft` starting in `month` (the changed version of a split item). A weekly item keeps its
 * weekday: its first date moves to the first charge of its cadence inside `month`.
 */
export function startingIn<T extends BudgetItemDraft>(draft: T, month: YearMonth): T {
  const later = filterSkipped(draft, (m) => compareYearMonths(m, month) >= 0);
  if (later.repeat !== 'weekly' || later.firstDate === undefined) return { ...later, month };
  return { ...later, month, firstDate: nextWeekly(later.firstDate, `${month}-01`) };
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

/** An item as it counts in one month: weekly items can be charged 4 or 5 times. */
export interface MonthEntry<T extends BudgetItem = BudgetItem> {
  item: T;
  times: number;
  /** `item.amount × times`. */
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
  /**
   * What the account must have available for the month's automatic charges: every expense that
   * repeats (weekly, monthly, or yearly in its month) plus the credit payments. One-offs aside.
   */
  fixedCharges: Cents;
  /** The repeating expenses inside `fixedCharges`. */
  repeatingExpenses: Cents;
  /** Non-zero categories, largest first. */
  byCategory: CategoryTotal[];
  incomeItems: MonthEntry<IncomeItem>[];
  expenseItems: MonthEntry<ExpenseItem>[];
  /** Expenses due this month that the user skipped; `amount` is what they would have cost. */
  skippedItems: MonthEntry<ExpenseItem>[];
  credits: CreditMonthPayment[];
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
const byAmountDesc = (a: { amount: Cents }, b: { amount: Cents }) => b.amount - a.amount;

function summarize(data: BudgetData, month: YearMonth, currency: Currency): MonthSummary {
  const due = data.items
    .filter((item) => item.currency === currency)
    .map((item) => {
      const times = scheduledIn(item, month);
      return { item, times, amount: item.amount * times };
    })
    .filter((entry) => entry.times > 0)
    .sort(byAmountDesc);
  const skippedItems = due.filter((e): e is MonthEntry<ExpenseItem> => isSkippedIn(e.item, month));
  const entries = due.filter((e) => !isSkippedIn(e.item, month));
  const incomeItems = entries.filter((e): e is MonthEntry<IncomeItem> => e.item.kind === 'income');
  const expenseItems = entries.filter(
    (e): e is MonthEntry<ExpenseItem> => e.item.kind === 'expense',
  );
  const credits = data.creditPayments
    .filter((p) => p.currency === currency && p.month === month)
    .sort(byAmountDesc);

  const income = sum(incomeItems.map((i) => i.amount));
  const creditPayments = sum(credits.map((c) => c.amount));
  const expenses = sum(expenseItems.map((i) => i.amount)) + creditPayments;
  const repeatingExpenses = sum(
    expenseItems.filter((e) => e.item.repeat !== 'none').map((e) => e.amount),
  );

  const totals = new Map<ExpenseCategory, Cents>();
  for (const { item, amount } of expenseItems) {
    totals.set(item.category, (totals.get(item.category) ?? 0) + amount);
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
    fixedCharges: repeatingExpenses + creditPayments,
    repeatingExpenses,
    byCategory,
    incomeItems,
    expenseItems,
    skippedItems,
    credits,
  };
}

/** One summary per currency with something in `month`. Currencies are never mixed. */
export function summarizeMonth(data: BudgetData, month: YearMonth): MonthSummary[] {
  return CURRENCIES.map((currency) => summarize(data, month, currency)).filter(
    (s) =>
      s.incomeItems.length + s.expenseItems.length + s.skippedItems.length + s.credits.length > 0,
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

interface Totals {
  income: Cents;
  expenses: Cents;
  left: Cents;
  months: number;
}

export interface YearSummary extends Totals {
  year: number;
  currency: Currency;
  /** January up to the current month (the whole year once it is over). */
  toDate: Totals;
  /** The months still ahead: only what repeats and scheduled credit payments. */
  projected: Totals;
}

function addUp(totals: readonly MonthTotals[]): Totals {
  const income = sum(totals.map((t) => t.income));
  const expenses = sum(totals.map((t) => t.expenses));
  return { income, expenses, left: income - expenses, months: totals.length };
}

/** January to December of `year`: what came in, what went out and what is left at year end. */
export function summarizeYear(
  data: BudgetData,
  currency: Currency,
  year: number,
  currentMonth: YearMonth,
): YearSummary {
  const yearText = String(year).padStart(4, '0');
  const totals = monthlyTotals(data, currency, monthRange(`${yearText}-01`, `${yearText}-12`));
  const past = totals.filter((t) => compareYearMonths(t.month, currentMonth) <= 0);
  const ahead = totals.filter((t) => compareYearMonths(t.month, currentMonth) > 0);
  return {
    year,
    currency,
    ...addUp(totals),
    toDate: addUp(past),
    projected: addUp(ahead),
  };
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
  | 'INVALID_REPEAT'
  | 'INVALID_FIRST_DATE'
  | 'INVALID_SKIP'
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
  if (!REPEATS.includes(item.repeat)) issues.push('INVALID_REPEAT');
  // Weekly items need their first charge, inside their first month; the rest have none.
  if (item.repeat === 'weekly') {
    if (
      item.firstDate === undefined ||
      !isIsoDate(item.firstDate) ||
      toYearMonth(item.firstDate) !== item.month
    ) {
      issues.push('INVALID_FIRST_DATE');
    }
  } else if (item.firstDate !== undefined) {
    issues.push('INVALID_FIRST_DATE');
  }
  if (item.skippedMonths !== undefined) {
    const { skippedMonths } = item;
    const sortedUnique = skippedMonths.every(
      (m, i) => isYearMonth(m) && (i === 0 || compareYearMonths(skippedMonths[i - 1]!, m) < 0),
    );
    if (!canSkip(item) || skippedMonths.length === 0 || !sortedUnique) issues.push('INVALID_SKIP');
  }
  if (item.endMonth !== undefined) {
    if (item.repeat === 'none') issues.push('END_WITHOUT_RECURRING');
    else if (!isYearMonth(item.endMonth)) issues.push('INVALID_MONTH');
    else if (isYearMonth(item.month) && compareYearMonths(item.endMonth, item.month) < 0) {
      issues.push('END_BEFORE_START');
    }
  }
  return issues;
}
