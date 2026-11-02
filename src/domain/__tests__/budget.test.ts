import { describe, expect, it } from 'vitest';
import {
  canHaveDueDay,
  canSplitAt,
  chargeDayPassed,
  creditMonthPayments,
  endBefore,
  firstBudgetMonth,
  fixedChargeDays,
  isActiveIn,
  monthlyTotals,
  isSkippedIn,
  occurrencesIn,
  pendingCharges,
  scheduledIn,
  startingIn,
  summarizeMonth,
  summarizeYear,
  validateBudgetItem,
  withSkipped,
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
  repeat: 'monthly',
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
  repeat: 'monthly',
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
  income('Bono', 5_000, { month: '2026-10', repeat: 'none' }),
  expense('Renta', 8_000, 'housing'),
  expense('Streaming', 299, 'subscriptions', { month: '2026-03', endMonth: '2026-11' }),
  expense('Café', 85.5, 'small', { month: '2026-10', repeat: 'none' }),
  expense('Hosting', 20, 'subscriptions', { currency: 'USD', month: '2026-06' }),
];

const data: BudgetData = { items, creditPayments: creditMonthPayments([msi, loan]) };

describe('repeating items', () => {
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

  it('keep their charge day when changed from a later month on', () => {
    const rent = expense('Renta', 8_000, 'housing', { dueDay: 5 });
    expect(endBefore(rent, '2026-10').dueDay).toBe(5);
    expect(startingIn(rent, '2026-10').dueDay).toBe(5);
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

describe('yearly items', () => {
  const prime = expense('Prime', 1_099, 'subscriptions', { month: '2026-03', repeat: 'yearly' });

  it('count the full amount in their month, every 12 months', () => {
    expect(occurrencesIn(prime, '2026-03')).toBe(1);
    expect(occurrencesIn(prime, '2026-04')).toBe(0);
    expect(occurrencesIn(prime, '2027-02')).toBe(0);
    expect(occurrencesIn(prime, '2027-03')).toBe(1);
    expect(occurrencesIn(prime, '2025-03')).toBe(0);
    expect(occurrencesIn({ ...prime, endMonth: '2027-12' }, '2028-03')).toBe(0);
  });

  it('can change from a later year on', () => {
    expect(canSplitAt(prime, '2027-03')).toBe(true);
    expect(canSplitAt(prime, '2027-04')).toBe(false); // not charged that month
  });
});

describe('weekly items', () => {
  // Fridays from Friday, October 2, 2026.
  const gas = expense('Gasolina', 500, 'transport', {
    month: '2026-10',
    repeat: 'weekly',
    firstDate: '2026-10-02',
  });

  it('count the real number of charges in each month', () => {
    expect(occurrencesIn(gas, '2026-10')).toBe(5); // 2, 9, 16, 23, 30
    expect(occurrencesIn(gas, '2026-11')).toBe(4); // 6, 13, 20, 27
    expect(occurrencesIn(gas, '2027-01')).toBe(5); // 1, 8, 15, 22, 29
    expect(occurrencesIn(gas, '2026-09')).toBe(0);
    expect(occurrencesIn({ ...gas, endMonth: '2026-11' }, '2026-12')).toBe(0);
  });

  it('start counting on their first date, not the first of the month', () => {
    const late = { ...gas, firstDate: '2026-10-30' };
    expect(occurrencesIn(late, '2026-10')).toBe(1);
    expect(occurrencesIn(late, '2026-11')).toBe(4); // 6, 13, 20, 27
    // Charged on the last day of a month: still counted there.
    expect(occurrencesIn({ ...gas, firstDate: '2026-10-31' }, '2026-10')).toBe(1);
    expect(occurrencesIn({ ...gas, firstDate: undefined }, '2026-10')).toBe(0);
  });

  it('show the month total in the summary', () => {
    const [mxn] = summarizeMonth({ items: [gas], creditPayments: [] }, '2026-10');
    expect(mxn?.expenseItems[0]).toMatchObject({ times: 5, amount: cents(2_500) });
    expect(mxn?.expenses).toBe(cents(2_500));
  });

  it('keep their weekday when changed from a later month on', () => {
    // A stored item works as a draft: the id is just carried along.
    expect(startingIn(gas, '2026-12')).toMatchObject({
      month: '2026-12',
      firstDate: '2026-12-04',
    });
    const monthly = { ...gas, repeat: 'monthly' as const, firstDate: undefined };
    expect(startingIn(monthly, '2026-12')).toEqual({ ...monthly, month: '2026-12' });
  });
});

describe('skipping a month', () => {
  const streaming = expense('Streaming', 299, 'subscriptions', {
    month: '2026-03',
    skippedMonths: ['2026-10'],
  });

  it('counts 0 that month and comes back the next', () => {
    expect(occurrencesIn(streaming, '2026-10')).toBe(0);
    expect(scheduledIn(streaming, '2026-10')).toBe(1);
    expect(isActiveIn(streaming, '2026-10')).toBe(true); // still listed, as skipped
    expect(occurrencesIn(streaming, '2026-11')).toBe(1);
  });

  it('skips every charge of the month for weekly items', () => {
    const gas = expense('Gasolina', 500, 'transport', {
      month: '2026-10',
      repeat: 'weekly',
      firstDate: '2026-10-02',
      skippedMonths: ['2026-11'],
    });
    expect(occurrencesIn(gas, '2026-10')).toBe(5);
    expect(occurrencesIn(gas, '2026-11')).toBe(0);
  });

  it('applies only to monthly and weekly expenses', () => {
    const yearly = { ...streaming, repeat: 'yearly' as const };
    const salary = income('Sueldo', 1, { skippedMonths: ['2026-10'] });
    expect(isSkippedIn(yearly, '2026-10')).toBe(false);
    expect(isSkippedIn(salary, '2026-10')).toBe(false);
  });

  it('leaves the skipped expense out of every total, but lists it apart', () => {
    const [mxn] = summarizeMonth(
      { items: [items[0]!, items[2]!, streaming], creditPayments: [] },
      '2026-10',
    );
    expect(mxn).toMatchObject({
      expenses: cents(8_000),
      fixedCharges: cents(8_000),
      left: cents(22_000),
    });
    expect(mxn?.expenseItems.map((e) => e.item.id)).toEqual(['Renta']);
    expect(mxn?.skippedItems).toEqual([{ item: streaming, times: 1, amount: cents(299) }]);
    expect(mxn?.byCategory.map((c) => c.category)).toEqual(['housing']);
  });

  it('adds and removes skipped months, kept sorted', () => {
    expect(withSkipped(undefined, '2026-10', true)).toEqual(['2026-10']);
    expect(withSkipped(['2026-11'], '2026-10', true)).toEqual(['2026-10', '2026-11']);
    expect(withSkipped(['2026-10', '2026-11'], '2026-10', true)).toEqual(['2026-10', '2026-11']);
    expect(withSkipped(['2026-10'], '2026-10', false)).toBeUndefined();
  });

  it('splits the skipped months when changed from a month on', () => {
    const paused = { ...streaming, skippedMonths: ['2026-05', '2026-10', '2027-01'] };
    expect(endBefore(paused, '2026-10').skippedMonths).toEqual(['2026-05']);
    expect(startingIn(paused, '2026-10').skippedMonths).toEqual(['2026-10', '2027-01']);
    expect(endBefore({ ...paused, skippedMonths: ['2027-01'] }, '2026-10')).not.toHaveProperty(
      'skippedMonths',
    );
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
        charges: [{ date: '2026-10-15', amount: cents(1_000) }],
        totalPayments: 12,
      },
      {
        creditId: 'loan',
        name: 'Préstamo',
        currency: 'MXN',
        month: '2026-10',
        amount: cents(500),
        numbers: [1],
        charges: [{ date: '2026-10-17', amount: cents(500) }],
        totalPayments: 6,
      },
    ]);
    const november = payments.find((p) => p.creditId === 'loan' && p.month === '2026-11');
    expect(november).toMatchObject({
      amount: cents(1_000),
      numbers: [2, 3],
      charges: [
        { date: '2026-11-02', amount: cents(500) },
        { date: '2026-11-17', amount: cents(500) },
      ],
    });
  });
});

describe('fixed charges by day', () => {
  const november: BudgetItem[] = [
    income('Sueldo', 30_000),
    expense('Renta', 8_000, 'housing', { dueDay: 1 }),
    // Day 31 in a 30-day month: charged on the 30th.
    expense('Internet', 600, 'services', { dueDay: 31 }),
    expense('Gimnasio', 500, 'health'),
    expense('Música', 150, 'subscriptions', { dueDay: 5 }),
    expense('Streaming', 299, 'subscriptions', { dueDay: 5 }),
    expense('Gasolina', 500, 'transport', {
      month: '2026-10',
      repeat: 'weekly',
      firstDate: '2026-10-02',
    }),
    expense('Seguro', 3_000, 'other', { month: '2026-11', repeat: 'yearly', dueDay: 20 }),
    expense('Café', 85.5, 'small', { month: '2026-11', repeat: 'none' }),
    expense('Revista', 120, 'leisure', { dueDay: 10, skippedMonths: ['2026-11'] }),
  ];
  const novemberData: BudgetData = {
    items: november,
    creditPayments: creditMonthPayments([msi, loan]),
  };
  const [summary] = summarizeMonth(novemberData, '2026-11');
  const days = fixedChargeDays(summary!);

  it('lists each charge on its day, with what to have before it', () => {
    expect(days.map((d) => [d.date, d.amount, d.cumulative])).toEqual([
      [null, cents(500), cents(500)], // Gimnasio: no day, counted from the 1st
      ['2026-11-01', cents(8_000), cents(8_500)],
      ['2026-11-02', cents(500), cents(9_000)], // loan, payment 2
      ['2026-11-05', cents(449), cents(9_449)],
      ['2026-11-06', cents(500), cents(9_949)],
      ['2026-11-13', cents(500), cents(10_449)],
      ['2026-11-15', cents(1_000), cents(11_449)], // MSI
      ['2026-11-17', cents(500), cents(11_949)], // loan, payment 3
      ['2026-11-20', cents(3_500), cents(15_449)],
      ['2026-11-27', cents(500), cents(15_949)],
      ['2026-11-30', cents(600), cents(16_549)],
    ]);
    // Adds up to the month's fixed charges: one-offs, income and skipped expenses are left out.
    expect(days.at(-1)?.cumulative).toBe(summary?.fixedCharges);
  });

  it('groups the charges of the same day, largest first', () => {
    const day = (date: string) => days.find((d) => d.date === date)?.charges;
    expect(day('2026-11-05')?.map((c) => c.name)).toEqual(['Streaming', 'Música']);
    expect(day('2026-11-20')).toEqual([
      { name: 'Seguro', amount: cents(3_000), source: { kind: 'item', id: 'Seguro' } },
      { name: 'Gasolina', amount: cents(500), source: { kind: 'item', id: 'Gasolina' } },
    ]);
    expect(day('2026-11-15')).toEqual([
      { name: 'Televisión', amount: cents(1_000), source: { kind: 'credit', id: 'tv' } },
    ]);
  });

  it('puts a yearly charge only in its month, and clamps the day to the month', () => {
    const [december] = summarizeMonth(novemberData, '2026-12');
    const names = fixedChargeDays(december!).flatMap((d) => d.charges.map((c) => c.name));
    expect(names).not.toContain('Seguro');
    const internet = [expense('Internet', 600, 'services', { dueDay: 31 })];
    const [february] = summarizeMonth({ items: internet, creditPayments: [] }, '2028-02');
    expect(fixedChargeDays(february!).map((d) => d.date)).toEqual(['2028-02-29']);
  });

  it('has nothing to list without repeating expenses or credits', () => {
    const [oneOff] = summarizeMonth({ items: [november[8]!], creditPayments: [] }, '2026-11');
    expect(fixedChargeDays(oneOff!)).toEqual([]);
  });

  it('tells what is still to be charged from a day on', () => {
    expect(pendingCharges(days, '2026-11-01')).toBe(cents(16_549));
    // From the 15th: the charges without a day (unknown), the 15th itself and the rest.
    expect(pendingCharges(days, '2026-11-15')).toBe(cents(500 + 1_000 + 500 + 3_500 + 500 + 600));
    expect(pendingCharges(days, '2026-12-01')).toBe(cents(500));
    expect(chargeDayPassed(days[0]!, '2026-12-01')).toBe(false);
    expect(chargeDayPassed(days[1]!, '2026-11-01')).toBe(false);
    expect(chargeDayPassed(days[1]!, '2026-11-02')).toBe(true);
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
    // Automatic charges: rent + streaming (repeat) + both credits; the coffee was a one-off.
    expect(mxn).toMatchObject({
      repeatingExpenses: cents(8_299),
      fixedCharges: cents(8_299 + 1_500),
    });
    expect(mxn?.byCategory).toEqual([
      { category: 'housing', amount: cents(8_000) },
      { category: 'credit', amount: cents(1_500) },
      { category: 'subscriptions', amount: cents(299) },
      { category: 'small', amount: cents(85.5) },
    ]);
    expect(mxn?.incomeItems.map((e) => e.item.id)).toEqual(['Sueldo', 'Bono']);
    expect(mxn?.expenseItems.map((e) => e.item.id)).toEqual(['Renta', 'Streaming', 'Café']);
    expect(mxn?.expenseItems[1]).toMatchObject({ times: 1, amount: cents(299) });
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

describe('summarizeYear', () => {
  it('adds up January to December, split at the current month', () => {
    const year = summarizeYear(data, 'MXN', 2026, '2026-10');
    // Income: 30,000 × 12 + 5,000 bonus. Expenses: rent 8,000 × 12, streaming 299 × 9 (Mar–Nov),
    // coffee 85.50, MSI 1,000 × 3 (Oct–Dec), loan 500 (Oct) + 1,000 (Nov) + 1,000 (Dec).
    const expenses = 96_000 + 2_691 + 85.5 + 3_000 + 2_500;
    expect(year).toMatchObject({
      year: 2026,
      currency: 'MXN',
      income: cents(365_000),
      expenses: cents(expenses),
      left: cents(365_000 - expenses),
      months: 12,
    });
    expect(year.toDate).toMatchObject({ income: cents(305_000), months: 10 });
    expect(year.projected).toMatchObject({
      income: cents(60_000),
      expenses: cents(16_000 + 299 + 2_000 + 2_000),
      months: 2,
    });
    expect(year.toDate.left + year.projected.left).toBe(year.left);
  });

  it('is all projection for a future year and all registered for a past one', () => {
    expect(summarizeYear(data, 'MXN', 2027, '2026-10').toDate.months).toBe(0);
    expect(summarizeYear(data, 'MXN', 2025, '2026-10').projected.months).toBe(0);
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
    expect(validateBudgetItem({ ...draft, repeat: 'none', endMonth: '2026-05' })).toEqual([
      'END_WITHOUT_RECURRING',
    ]);
    expect(validateBudgetItem({ ...draft, repeat: 'daily' as 'none' })).toEqual(['INVALID_REPEAT']);
    expect(validateBudgetItem({ ...draft, repeat: 'weekly' })).toEqual(['INVALID_FIRST_DATE']);
    expect(validateBudgetItem({ ...draft, repeat: 'weekly', firstDate: '2026-02-03' })).toEqual([
      'INVALID_FIRST_DATE',
    ]); // outside its first month (January)
    expect(validateBudgetItem({ ...draft, repeat: 'weekly', firstDate: '2026-01-07' })).toEqual([]);
    expect(validateBudgetItem({ ...draft, firstDate: '2026-01-07' })).toEqual([
      'INVALID_FIRST_DATE',
    ]);
    expect(validateBudgetItem({ ...draft, skippedMonths: ['2026-03', '2026-05'] })).toEqual([]);
    for (const skippedMonths of [[], ['2026-05', '2026-03'], ['2026-03', '2026-03'], ['2026-13']]) {
      expect(validateBudgetItem({ ...draft, skippedMonths }), String(skippedMonths)).toEqual([
        'INVALID_SKIP',
      ]);
    }
    expect(validateBudgetItem({ ...draft, repeat: 'none', skippedMonths: ['2026-01'] })).toEqual([
      'INVALID_SKIP',
    ]);
  });

  it('accepts a charge day only on monthly and yearly expenses, from 1 to 31', () => {
    expect(validateBudgetItem({ ...draft, dueDay: 1 })).toEqual([]);
    expect(validateBudgetItem({ ...draft, repeat: 'yearly', dueDay: 31 })).toEqual([]);
    for (const dueDay of [0, 32, 1.5, -3, Number.NaN]) {
      expect(validateBudgetItem({ ...draft, dueDay }), String(dueDay)).toEqual(['INVALID_DUE_DAY']);
    }
    const weekly = { ...draft, repeat: 'weekly' as const, firstDate: '2026-01-07', dueDay: 7 };
    expect(validateBudgetItem(weekly)).toEqual(['INVALID_DUE_DAY']);
    expect(validateBudgetItem({ ...draft, repeat: 'none', dueDay: 7 })).toEqual([
      'INVALID_DUE_DAY',
    ]);
    expect(validateBudgetItem(income('Sueldo', 30_000, { dueDay: 15 }))).toEqual([
      'INVALID_DUE_DAY',
    ]);
    expect(canHaveDueDay({ kind: 'expense', repeat: 'monthly' })).toBe(true);
    expect(canHaveDueDay({ kind: 'expense', repeat: 'weekly' })).toBe(false);
    expect(canHaveDueDay({ kind: 'income', repeat: 'monthly' })).toBe(false);
  });

  it('incomes have no category', () => {
    expect(validateBudgetItem(income('Sueldo', 30_000))).toEqual([]);
  });
});
