import { describe, expect, it } from 'vitest';
import type { Credit } from '../../domain/credit';
import { strings } from '../../i18n/es-MX';
import {
  emptyBudgetItemValues,
  parseBudgetItemForm,
  valuesFromItem,
} from '../budget/budgetItemForm';
import { budgetPath, monthParam } from '../budget/budgetHelpers';
import {
  emptyCreditValues,
  parseCreditForm,
  parsePlanForm,
  valuesFromCredit,
} from '../credits/creditForm';

const TODAY = '2026-10-25';

describe('budget item form', () => {
  it('builds an expense draft, trimming the name', () => {
    const values = {
      ...emptyBudgetItemValues('expense', '2026-10', TODAY),
      name: '  Netflix ',
      amount: '299',
      category: 'subscriptions' as const,
      repeat: 'monthly' as const,
      hasEnd: true,
      endMonth: '2027-03',
    };
    expect(parseBudgetItemForm(values)).toEqual({
      ok: true,
      draft: {
        kind: 'expense',
        name: 'Netflix',
        amount: 29_900,
        currency: 'MXN',
        category: 'subscriptions',
        month: '2026-10',
        repeat: 'monthly',
        endMonth: '2027-03',
      },
    });
  });

  it('defaults: income repeats monthly, expenses once; weekly starts today in the current month', () => {
    expect(emptyBudgetItemValues('income', '2026-10', TODAY)).toMatchObject({
      repeat: 'monthly',
      firstDate: TODAY,
    });
    expect(emptyBudgetItemValues('expense', '2026-12', TODAY)).toMatchObject({
      repeat: 'none',
      firstDate: '2026-12-01',
    });
  });

  it('drops the end month of one-off items and the category of incomes', () => {
    const income = {
      ...emptyBudgetItemValues('income', '2026-10', TODAY),
      name: 'Bono',
      amount: '5,000',
      repeat: 'none' as const,
      hasEnd: true,
    };
    const parsed = parseBudgetItemForm(income);
    expect(parsed.ok && parsed.draft).toEqual({
      kind: 'income',
      name: 'Bono',
      amount: 500_000,
      currency: 'MXN',
      month: '2026-10',
      repeat: 'none',
    });
  });

  it('weekly items take their month from the first charge', () => {
    const parsed = parseBudgetItemForm({
      ...emptyBudgetItemValues('expense', '2026-10', TODAY),
      name: 'Gasolina',
      amount: '500',
      repeat: 'weekly',
      firstDate: '2026-11-06',
    });
    expect(parsed.ok && parsed.draft).toMatchObject({
      repeat: 'weekly',
      month: '2026-11',
      firstDate: '2026-11-06',
    });
    expect(
      parseBudgetItemForm({
        ...emptyBudgetItemValues('expense', '2026-10', TODAY),
        name: 'Gasolina',
        amount: '500',
        repeat: 'weekly',
        firstDate: '',
      }),
    ).toMatchObject({ ok: false, errors: { firstDate: strings.errors.invalidDate } });
  });

  it('a change from a later month on starts there and keeps the weekday', () => {
    const values = {
      ...emptyBudgetItemValues('expense', '2026-10', TODAY),
      name: 'Gasolina',
      amount: '600',
      repeat: 'weekly' as const,
      firstDate: '2026-10-02',
      hasEnd: true,
      endMonth: '2026-11',
    };
    expect(parseBudgetItemForm(values, '2026-12')).toMatchObject({
      ok: false,
      errors: { endMonth: strings.errors.budgetIssue('END_BEFORE_START') },
    });
    const parsed = parseBudgetItemForm({ ...values, hasEnd: false }, '2026-12');
    expect(parsed.ok && parsed.draft).toMatchObject({ month: '2026-12', firstDate: '2026-12-04' });
  });

  it('reports field errors', () => {
    const parsed = parseBudgetItemForm({
      ...emptyBudgetItemValues('expense', '2026-10', TODAY),
      amount: '0',
      repeat: 'monthly',
      hasEnd: true,
      endMonth: '2026-09',
    });
    expect(parsed).toEqual({
      ok: false,
      errors: {
        name: strings.errors.nameLength(60),
        amount: strings.errors.invalidAmount,
        endMonth: strings.errors.budgetIssue('END_BEFORE_START'),
      },
    });
    expect(
      parseBudgetItemForm({ ...emptyBudgetItemValues('income', '2026-10', TODAY), name: 'x' }),
    ).toMatchObject({ ok: false, errors: { amount: strings.errors.required } });
  });

  it('round-trips stored items', () => {
    const rent = {
      id: 'i',
      kind: 'expense' as const,
      name: 'Renta',
      amount: 800_000,
      currency: 'USD' as const,
      category: 'housing' as const,
      month: '2026-01',
      repeat: 'yearly' as const,
      endMonth: '2030-12',
    };
    const gas = {
      ...rent,
      id: 'g',
      repeat: 'weekly' as const,
      month: '2026-10',
      firstDate: '2026-10-02',
    };
    for (const { id, ...stored } of [rent, gas]) {
      const parsed = parseBudgetItemForm(valuesFromItem({ id, ...stored }));
      expect(parsed.ok && parsed.draft).toEqual(stored);
    }
  });

  it('carries skipped months through an edit, and drops them when they no longer apply', () => {
    const streaming = {
      id: 's',
      kind: 'expense' as const,
      name: 'Streaming',
      amount: 29_900,
      currency: 'MXN' as const,
      category: 'subscriptions' as const,
      month: '2026-01',
      repeat: 'monthly' as const,
      skippedMonths: ['2026-10'],
    };
    const values = valuesFromItem(streaming);
    const kept = parseBudgetItemForm(values);
    expect(kept.ok && kept.draft.skippedMonths).toEqual(['2026-10']);
    const yearly = parseBudgetItemForm({ ...values, repeat: 'yearly' });
    expect(yearly.ok && yearly.draft).not.toHaveProperty('skippedMonths');
    const income = parseBudgetItemForm({ ...values, kind: 'income' });
    expect(income.ok && income.draft).not.toHaveProperty('skippedMonths');
  });

  it('reads the month from the URL', () => {
    expect(monthParam('2026-07', '2026-10')).toBe('2026-07');
    expect(monthParam('2026-13', '2026-10')).toBe('2026-10');
    expect(monthParam(null, '2026-10')).toBe('2026-10');
    expect(budgetPath('2026-07')).toBe('/budget?month=2026-07');
  });
});

const loan: Credit = {
  id: 'c',
  name: 'Préstamo',
  currency: 'MXN',
  annualRateBps: 0,
  ivaOnInterest: false,
  frequency: 'monthly',
  upfrontFees: 0,
  plans: [{ firstPaymentDate: '2026-01-10', balance: 1_200_000, payment: 100_000 }],
};

describe('credit form', () => {
  const filled = {
    ...emptyCreditValues('2026-10-25'),
    name: 'Préstamo',
    balance: '100,000',
    rate: '27.5',
    frequency: 'semimonthly' as const,
    firstPaymentDate: '2026-11-02',
    count: '120',
    fees: '5,000',
  };

  it('computes the fixed payment from the number of payments', () => {
    const parsed = parseCreditForm(filled);
    expect(parsed.ok && parsed.draft).toEqual({
      name: 'Préstamo',
      currency: 'MXN',
      annualRateBps: 2750,
      ivaOnInterest: true,
      frequency: 'semimonthly',
      upfrontFees: 500_000,
      plans: [{ firstPaymentDate: '2026-11-02', balance: 10_000_000, payment: 154_912 }],
    });
  });

  it('takes the fixed payment as typed', () => {
    const parsed = parseCreditForm({ ...filled, mode: 'payment', payment: '2,400' });
    expect(parsed.ok && parsed.draft.plans[0]?.payment).toBe(240_000);
  });

  it('reports every field problem', () => {
    const parsed = parseCreditForm({
      ...emptyCreditValues('2026-10-25'),
      rate: '1000',
      firstPaymentDate: '2026-02-30',
      count: '0',
      fees: 'x',
    });
    expect(parsed).toEqual({
      ok: false,
      errors: {
        name: strings.errors.nameLength(60),
        balance: strings.errors.required,
        rate: strings.errors.creditIssue('INVALID_RATE'),
        firstPaymentDate: strings.errors.invalidDate,
        count: strings.credit.invalidCount,
        fees: strings.errors.invalidAmount,
      },
    });
    expect(parseCreditForm({ ...filled, mode: 'payment', payment: '' })).toMatchObject({
      ok: false,
      errors: { payment: strings.errors.required },
    });
  });

  it('places domain issues next to their field', () => {
    expect(parseCreditForm({ ...filled, mode: 'payment', payment: '10' })).toMatchObject({
      ok: false,
      errors: { payment: strings.errors.creditIssue('PAYMENT_TOO_LOW') },
    });
    expect(parseCreditForm({ ...filled, fees: '200,000' })).toMatchObject({
      ok: false,
      errors: { fees: strings.errors.creditIssue('INVALID_FEES') },
    });
  });

  it('keeps the balance updates of an edited credit, and flags ones now out of order', () => {
    const later = { firstPaymentDate: '2026-06-10', balance: 300_000, payment: 100_000 };
    const values = valuesFromCredit({ ...loan, plans: [...loan.plans, later] });
    expect(values).toMatchObject({ mode: 'payment', payment: '1,000.00', rate: '0' });

    const parsed = parseCreditForm(values, [later]);
    expect(parsed.ok && parsed.draft.plans).toEqual([...loan.plans, later]);

    const moved = parseCreditForm({ ...values, firstPaymentDate: '2026-07-10' }, [later]);
    expect(moved).toMatchObject({
      ok: false,
      errors: { other: [strings.errors.creditIssue('PLANS_OUT_OF_ORDER')] },
    });
  });
});

describe('balance update form', () => {
  it('adds a plan after the first payment', () => {
    const parsed = parsePlanForm(
      { owed: '5,000', nextPaymentDate: '2026-04-10', payment: '1,000' },
      loan,
    );
    expect(parsed.ok && parsed.plan).toEqual({
      firstPaymentDate: '2026-04-10',
      balance: 500_000,
      payment: 100_000,
    });
    expect(parsed.ok && parsed.draft.plans).toHaveLength(2);
  });

  it('accepts a paid-off credit without a payment', () => {
    const parsed = parsePlanForm({ owed: '0', nextPaymentDate: '2026-04-10', payment: '' }, loan);
    expect(parsed.ok && parsed.plan).toMatchObject({ balance: 0, payment: 0 });
  });

  it('rejects dates on or before the first payment and missing data', () => {
    expect(parsePlanForm({ owed: '', nextPaymentDate: '2026-01-10', payment: '' }, loan)).toEqual({
      ok: false,
      errors: {
        owed: strings.errors.required,
        nextPaymentDate: strings.credit.updateAfterFirst('10 ene 2026'),
        payment: strings.errors.required,
      },
    });
    expect(
      parsePlanForm({ owed: '5,000', nextPaymentDate: 'x', payment: '1,000' }, loan),
    ).toMatchObject({ ok: false, errors: { nextPaymentDate: strings.errors.invalidDate } });
  });

  it('explains a payment that does not cover the interest', () => {
    const parsed = parsePlanForm(
      { owed: '5,000', nextPaymentDate: '2026-04-10', payment: '1' },
      { ...loan, annualRateBps: 6_000 },
    );
    expect(parsed).toMatchObject({
      ok: false,
      errors: { payment: strings.errors.creditIssue('PAYMENT_TOO_LOW') },
    });
  });
});
