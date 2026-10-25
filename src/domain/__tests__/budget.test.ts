import { describe, expect, it } from 'vitest';
import {
  canSplitAt,
  creditMonthPayments,
  endBefore,
  firstBudgetMonth,
  isActiveIn,
  monthlyTotals,
  summarizeMonth,
  validateBudgetItem,
  type BudgetData,
  type BudgetItem,
  type ExpenseItem,
  type IncomeItem,
} from '../budget';
import type { Credit } from '../credit';
import { cents } from './builders';

const income = (id: string, units: number, extra: Partial<IncomeItem> = {}): IncomeItem => ({
  id,
  kind: 'income',
  name: id,
  amount: cents(units),
  currency: 'MXN',
  month: '2026-01',
  recurring: true,
  ...extra,
});

const expense = (
  id: string,
  units: number,
  category: ExpenseItem['category'],
  extra: Partial<ExpenseItem> = {},
): ExpenseItem => ({
  id,
  kind: 'expense',
  name: id,
  amount: cents(units),
  currency: 'MXN',
  category,
  month: '2026-01',
  recurring: true,
  ...extra,
});

/** 12,000 interest-free in 12 monthly payments of 1,000 from Oct 15, 2026 (MSI). */
const msi: Credit = {
  id: 'tv',
  name: 'Televisión',
  currency: 'MXN',
  annualRateBps: 0,
  ivaOnInterest: false,
  frequency: 'monthly',
  upfrontFees: 0,
  plans: [{ firstPaymentDate: '2026-10-15', balance: cents(12_000), payment: cents(1_000) }],
};

/** Quincenal: two payments in most months. */
const loan: Credit = {
  ...msi,
  id: 'loan',
  name: 'Préstamo',
  frequency: 'semimonthly',
  plans: [{ firstPaymentDate: '2026-10-17', balance: cents(3_000), payment: cents(500) }],
};

const items: BudgetItem[] = [
  income('Sueldo', 30_000),
  income('Bono', 5_000, { month: '2026-10', recurring: false }),
  expense('Renta', 8_000, 'housing'),
  expense('Streaming', 299, 'subscriptions', { month: '2026-03', endMonth: '2026-11' }),
  expense('Café', 85.5, 'small', { month: '2026-10', recurring: false }),
  expense('Hosting', 20, 'subscriptions', { currency: 'USD', month: '2026-06' }),
];

const data: BudgetData = { items, creditPayments: creditMonthPayments([msi, loan]) };

describe('recurring items', () => {
  it('count from their first month until their end month', () => {
    const streaming = items[3]!;
    expect(isActiveIn(streaming, '2026-02')).toBe(false);
    expect(isActiveIn(streaming, '2026-03')).toBe(true);
    expect(isActiveIn(streaming, '2026-11')).toBe(true);
    expect(isActiveIn(streaming, '2026-12')).toBe(false);
    expect(isActiveIn(items[0]!, '2040-01')).toBe(true);
  });

  it('one-off items count only in their month', () => {
    expect(isActiveIn(items[1]!, '2026-10')).toBe(true);
    expect(isActiveIn(items[1]!, '2026-11')).toBe(false);
  });

  it('can be changed from a later month on, keeping the past', () => {
    const rent = items[2]!;
    expect(canSplitAt(rent, '2026-10')).toBe(true);
    expect(canSplitAt(rent, '2026-01')).toBe(false); // its first month: edit it whole
    expect(canSplitAt(items[3]!, '2026-12')).toBe(false); // no longer counts
    expect(canSplitAt(items[1]!, '2026-10')).toBe(false); // one-off
    expect(endBefore(rent, '2026-10')).toEqual({ ...rent, endMonth: '2026-09' });
  });
});

describe('credit payments by month', () => {
  it('groups each credit by month, IVA included, with payment numbers', () => {
    const payments = creditMonthPayments([msi, loan]);
    const october = payments.filter((p) => p.month === '2026-10');
    expect(october).toEqual([
      {
        creditId: 'tv',
        name: 'Televisión',
        currency: 'MXN',
        month: '2026-10',
        amount: cents(1_000),
        numbers: [1],
        totalPayments: 12,
      },
      {
        creditId: 'loan',
        name: 'Préstamo',
        currency: 'MXN',
        month: '2026-10',
        amount: cents(500),
        numbers: [1],
        totalPayments: 6,
      },
    ]);
    const november = payments.find((p) => p.creditId === 'loan' && p.month === '2026-11');
    expect(november).toMatchObject({ amount: cents(1_000), numbers: [2, 3] });
  });
});

describe('summarizeMonth', () => {
  it('adds up what came in and went out, credits included, per currency', () => {
    const [usd, mxn] = summarizeMonth(data, '2026-10');

    expect(usd).toMatchObject({
      currency: 'USD',
      income: 0,
      expenses: cents(20),
      left: cents(-20),
    });
    expect(usd?.spentRatio).toBeNull();

    // 30,000 + 5,000 in; 8,000 + 299 + 85.50 + 1,000 (MSI) + 500 (loan) out.
    expect(mxn).toMatchObject({
      currency: 'MXN',
      income: cents(35_000),
      expenses: cents(9_884.5),
      left: cents(25_115.5),
      creditPayments: cents(1_500),
    });
    expect(mxn?.spentRatio).toBeCloseTo(9_884.5 / 35_000, 10);
    expect(mxn?.byCategory).toEqual([
      { category: 'housing', amount: cents(8_000) },
      { category: 'credit', amount: cents(1_500) },
      { category: 'subscriptions', amount: cents(299) },
      { category: 'small', amount: cents(85.5) },
    ]);
    expect(mxn?.incomeItems.map((i) => i.id)).toEqual(['Sueldo', 'Bono']);
    expect(mxn?.expenseItems.map((i) => i.id)).toEqual(['Renta', 'Streaming', 'Café']);
    expect(mxn?.credits.map((c) => c.creditId)).toEqual(['tv', 'loan']);
  });

  it('leaves out currencies without anything that month', () => {
    expect(summarizeMonth(data, '2026-02').map((s) => s.currency)).toEqual(['MXN']);
    expect(summarizeMonth({ items: [], creditPayments: [] }, '2026-02')).toEqual([]);
  });
});

describe('history', () => {
  it('totals each month in one currency', () => {
    expect(monthlyTotals(data, 'MXN', ['2026-02', '2026-10', '2026-12'])).toEqual([
      { month: '2026-02', income: cents(30_000), expenses: cents(8_000), left: cents(22_000) },
      {
        month: '2026-10',
        income: cents(35_000),
        expenses: cents(9_884.5),
        left: cents(25_115.5),
      },
      // Streaming ended in November; the loan pays twice; the MSI keeps going.
      { month: '2026-12', income: cents(30_000), expenses: cents(10_000), left: cents(20_000) },
    ]);
  });

  it('finds the first month with data', () => {
    expect(firstBudgetMonth(data)).toBe('2026-01');
    expect(firstBudgetMonth({ items: [], creditPayments: creditMonthPayments([msi]) })).toBe(
      '2026-10',
    );
    expect(
      firstBudgetMonth({
        items: [income('Sueldo', 1, { month: '2027-01' })],
        creditPayments: creditMonthPayments([msi]),
      }),
    ).toBe('2026-10');
    expect(firstBudgetMonth({ items: [], creditPayments: [] })).toBeNull();
  });
});

describe('validateBudgetItem', () => {
  // Validation ignores the id: a stored item is checked the same way as a draft.
  const draft = expense('Renta', 8_000, 'housing');

  it('accepts a valid item', () => {
    expect(validateBudgetItem(draft)).toEqual([]);
    expect(validateBudgetItem({ ...draft, endMonth: '2026-01' })).toEqual([]);
  });

  it('reports each problem', () => {
    expect(validateBudgetItem({ ...draft, name: ' ' })).toEqual(['INVALID_NAME']);
    expect(validateBudgetItem({ ...draft, name: 'x'.repeat(61) })).toEqual(['INVALID_NAME']);
    expect(validateBudgetItem({ ...draft, amount: 0 })).toEqual(['INVALID_AMOUNT']);
    expect(validateBudgetItem({ ...draft, amount: 1.5 })).toEqual(['INVALID_AMOUNT']);
    expect(validateBudgetItem({ ...draft, currency: 'EUR' as 'MXN' })).toEqual([
      'INVALID_CURRENCY',
    ]);
    expect(validateBudgetItem({ ...draft, category: 'pets' as 'other' })).toEqual([
      'INVALID_CATEGORY',
    ]);
    expect(validateBudgetItem({ ...draft, month: '2026-13' })).toEqual(['INVALID_MONTH']);
    expect(validateBudgetItem({ ...draft, endMonth: '2026' })).toEqual(['INVALID_MONTH']);
    expect(validateBudgetItem({ ...draft, endMonth: '2025-12' })).toEqual(['END_BEFORE_START']);
    expect(validateBudgetItem({ ...draft, recurring: false, endMonth: '2026-05' })).toEqual([
      'END_WITHOUT_RECURRING',
    ]);
  });

  it('incomes have no category', () => {
    expect(validateBudgetItem(income('Sueldo', 30_000))).toEqual([]);
  });
});
