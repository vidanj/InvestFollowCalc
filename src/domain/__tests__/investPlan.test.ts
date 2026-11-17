import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INVEST_PLAN,
  investProgress,
  investmentReturns,
  parseInvestPlan,
  projectContributions,
  resolveRate,
  suggestInvestment,
  type CurrencyReturns,
} from '../investPlan';
import { summarizeMonth, type BudgetItem, type ExpenseItem, type IncomeItem } from '../budget';
import { account, balance, deposit, withdrawal } from './builders';

// Projection values come from an independent reference (exact decimals, cents rounded half up
// every month), cross-checked against the closed-form annuity formula.

describe('investProgress', () => {
  const sueldo: IncomeItem = {
    id: 'i1',
    kind: 'income',
    name: 'Sueldo',
    amount: 3_000_000,
    currency: 'MXN',
    month: '2026-01',
    repeat: 'monthly',
  };
  const renta: ExpenseItem = {
    id: 'x1',
    kind: 'expense',
    category: 'housing',
    name: 'Renta',
    amount: 1_000_000,
    currency: 'MXN',
    month: '2026-01',
    repeat: 'monthly',
  };
  const linked = (kind: 'income' | 'expense', amount: number, id: string): BudgetItem =>
    kind === 'income'
      ? { ...sueldo, id, amount, repeat: 'none', sourceEventId: `e-${id}` }
      : { ...renta, id, amount, category: 'investment', repeat: 'none', sourceEventId: `e-${id}` };
  const summary = (items: BudgetItem[]) =>
    summarizeMonth({ items, creditPayments: [] }, '2026-01').find((s) => s.currency === 'MXN');

  it('equals the plain suggestion without linked movements', () => {
    expect(investProgress(summary([sueldo, renta]), 20)).toEqual({
      ...suggestInvestment(3_000_000, 2_000_000, 20),
      income: 3_000_000,
      invested: 0,
      pending: 600_000,
    });
    expect(investProgress(undefined, 20)).toEqual({
      target: 0,
      amount: 0,
      capped: false,
      income: 0,
      invested: 0,
      pending: 0,
    });
  });

  it('counts linked contributions as invested, not as expenses that shrink the suggestion', () => {
    const s = summary([sueldo, renta, linked('expense', 250_000, 'a')]);
    expect(s?.left).toBe(1_750_000);
    expect(investProgress(s, 20)).toEqual({
      target: 600_000,
      amount: 600_000,
      capped: false,
      income: 3_000_000,
      invested: 250_000,
      pending: 350_000,
    });
  });

  it('nets linked withdrawals and leaves them out of the income for the target', () => {
    const s = summary([
      sueldo,
      renta,
      linked('expense', 700_000, 'a'),
      linked('income', 900_000, 'b'),
    ]);
    expect(s?.income).toBe(3_900_000);
    expect(investProgress(s, 20)).toEqual({
      target: 600_000,
      amount: 600_000,
      capped: false,
      income: 3_000_000,
      invested: 0, // withdrew more than contributed: never negative
      pending: 600_000,
    });
  });

  it('never leaves a negative pending amount', () => {
    const s = summary([sueldo, renta, linked('expense', 900_000, 'a')]);
    expect(investProgress(s, 20)).toMatchObject({ amount: 600_000, invested: 900_000, pending: 0 });
  });

  it('property: linked movements never change target and amount', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kind: fc.constantFrom('income' as const, 'expense' as const),
            amount: fc.integer({ min: 1, max: 10_000_000 }),
          }),
          { maxLength: 6 },
        ),
        fc.integer({ min: 0, max: 100 }),
        (moves, percent) => {
          const base = investProgress(summary([sueldo, renta]), percent);
          const items = moves.map((m, i) => linked(m.kind, m.amount, `m${i}`));
          const withLinks = investProgress(summary([sueldo, renta, ...items]), percent);
          expect(withLinks.target).toBe(base.target);
          expect(withLinks.amount).toBe(base.amount);
          expect(withLinks.pending).toBe(Math.max(0, base.amount - withLinks.invested));
          expect(withLinks.invested).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

describe('suggestInvestment', () => {
  it('suggests a share of the income', () => {
    expect(suggestInvestment(3_000_000, 2_000_000, 20)).toEqual({
      target: 600_000,
      amount: 600_000,
      capped: false,
    });
  });

  it('never suggests more than what is left, nor less than zero', () => {
    expect(suggestInvestment(3_000_000, 400_000, 20)).toEqual({
      target: 600_000,
      amount: 400_000,
      capped: true,
    });
    expect(suggestInvestment(3_000_000, -50_000, 20)).toMatchObject({ amount: 0, capped: true });
  });

  it('rounds to the cent and handles no income', () => {
    expect(suggestInvestment(1_001, 1_001, 15).target).toBe(150); // 150.15 → 150
    expect(suggestInvestment(1_003, 1_003, 50).target).toBe(502); // 501.5 → 502
    expect(suggestInvestment(0, -100, 20)).toEqual({ target: 0, amount: 0, capped: false });
    expect(suggestInvestment(Number.MAX_SAFE_INTEGER, 0, 100).target).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('projectContributions', () => {
  it('2,000 a month at 10% a year', () => {
    const points = projectContributions(200_000, 0.1, 120);
    expect(points[0]).toEqual({ month: 0, contributed: 0, value: 0, generated: 0 });
    expect(points[1]).toEqual({ month: 1, contributed: 200_000, value: 200_000, generated: 0 });
    expect(points[12]).toEqual({
      month: 12,
      contributed: 2_400_000,
      value: 2_508_107,
      generated: 108_107,
    });
    expect(points[120]).toEqual({
      month: 120,
      contributed: 24_000_000,
      value: 39_972_774,
      generated: 15_972_774,
    });
  });

  it('6,000 a month at 5.6% for 5 years', () => {
    expect(projectContributions(600_000, 0.056, 60)[60]).toMatchObject({
      value: 41_287_468,
      generated: 5_287_468,
    });
  });

  it('a negative return projects a loss', () => {
    expect(projectContributions(100_000, -0.05, 12)[12]).toMatchObject({
      value: 1_172_245,
      generated: -27_755,
    });
  });

  it('rejects impossible rates', () => {
    expect(() => projectContributions(100, -1, 12)).toThrow(RangeError);
    expect(() => projectContributions(100, Number.NaN, 12)).toThrow(RangeError);
  });

  it('stays within cents of the annuity formula and never loses money at a positive rate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.double({ min: 0.0001, max: 1, noNaN: true }),
        fc.integer({ min: 1, max: 360 }),
        (monthly, rate, months) => {
          const points = projectContributions(monthly, rate, months);
          const last = points.at(-1)!;
          const r = (1 + rate) ** (1 / 12) - 1;
          const closed = (monthly * ((1 + r) ** months - 1)) / r;
          // Each month's rounding is at most half a cent, and those errors compound too.
          const annuityFactor = ((1 + r) ** months - 1) / r;
          expect(Math.abs(last.value - closed)).toBeLessThanOrEqual(0.5 * annuityFactor + 1e-6);
          for (const p of points) {
            expect(p.generated).toBe(p.value - p.contributed);
            expect(p.generated).toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('at 0% the value is what was contributed', () => {
    expect(projectContributions(12_345, 0, 24).every((p) => p.generated === 0)).toBe(true);
  });
});

describe('investment returns', () => {
  // Grows 1% in 30 days, then a deposit: the same history as the portfolio would read.
  const ahorro = {
    account: account('ahorro'),
    events: [balance('2026-01-01', 10_000), balance('2026-01-31', 10_100)],
  };
  const fondo = {
    account: account('fondo'),
    events: [
      balance('2026-01-01', 5_000),
      deposit('2026-01-15', 1_000, 6_000),
      balance('2026-03-01', 6_060),
    ],
  };
  const archived = {
    account: { ...account('viejo'), archived: true },
    events: [balance('2026-01-01', 1_000), balance('2026-06-01', 2_000)],
  };
  const dollars = {
    account: account('usd', 'USD'),
    events: [balance('2026-01-01', 1_000), balance('2026-02-01', 1_010)],
  };

  it('reads the annualized TWR of the portfolio and of each active account', () => {
    const returns = investmentReturns([ahorro, fondo, archived, dollars], 'MXN');
    expect(returns.accounts.map((a) => a.accountId)).toEqual(['ahorro', 'fondo']);
    expect(returns.accounts[0]?.rate).toBeCloseTo(1.01 ** (365 / 30) - 1, 10);
    expect(returns.accounts[0]?.isShortPeriod).toBe(false);
    expect(returns.portfolio?.rate).not.toBeNull();
  });

  it('marks short histories and handles currencies without accounts', () => {
    const short = {
      account: account('nuevo'),
      events: [balance('2026-01-01', 1_000), balance('2026-01-11', 1_001)],
    };
    expect(investmentReturns([short], 'MXN').accounts[0]?.isShortPeriod).toBe(true);
    expect(investmentReturns([ahorro], 'USD')).toEqual({
      currency: 'USD',
      portfolio: null,
      accounts: [],
    });
  });

  it('skips accounts that cannot be computed', () => {
    const broken = { account: account('roto'), events: [withdrawal('2026-01-01', 5)] };
    const returns = investmentReturns([broken, ahorro], 'MXN');
    expect(returns.accounts.map((a) => a.accountId)).toEqual(['ahorro']);
    expect(returns.portfolio).toBeNull();
  });
});

describe('resolveRate', () => {
  const returns: CurrencyReturns = {
    currency: 'MXN',
    portfolio: { rate: 0.1, isShortPeriod: false },
    accounts: [{ accountId: 'a', name: 'A', rate: 0.05, isShortPeriod: true }],
  };

  it('uses the portfolio by default', () => {
    expect(resolveRate(returns, undefined)).toEqual({
      source: { kind: 'portfolio' },
      rate: 0.1,
      isShortPeriod: false,
    });
  });

  it('uses a chosen account, falling back to the portfolio when it is gone', () => {
    expect(resolveRate(returns, { kind: 'account', accountId: 'a' })).toMatchObject({
      rate: 0.05,
      isShortPeriod: true,
    });
    expect(resolveRate(returns, { kind: 'account', accountId: 'gone' })).toMatchObject({
      source: { kind: 'portfolio' },
      rate: 0.1,
    });
  });

  it('uses a typed rate, and has none without investments', () => {
    expect(resolveRate(returns, { kind: 'manual', rateBps: 1_050 }).rate).toBeCloseTo(0.105, 12);
    expect(resolveRate({ currency: 'MXN', portfolio: null, accounts: [] }, undefined)).toEqual({
      source: { kind: 'portfolio' },
      rate: null,
      isShortPeriod: false,
    });
  });
});

describe('parseInvestPlan', () => {
  it('keeps valid choices', () => {
    const plan = {
      percent: 15,
      sources: {
        MXN: { kind: 'manual', rateBps: 1_000 },
        USD: { kind: 'account', accountId: 'x' },
      },
    };
    expect(parseInvestPlan(plan)).toEqual(plan);
  });

  it('falls back to defaults field by field', () => {
    expect(parseInvestPlan(null)).toEqual(DEFAULT_INVEST_PLAN);
    expect(parseInvestPlan('20')).toEqual(DEFAULT_INVEST_PLAN);
    expect(
      parseInvestPlan({
        percent: 101,
        sources: {
          MXN: { kind: 'manual', rateBps: -5 },
          USD: { kind: 'portfolio' },
          EUR: { kind: 'portfolio' },
        },
      }),
    ).toEqual({ percent: 20, sources: { USD: { kind: 'portfolio' } } });
    expect(parseInvestPlan({ percent: 5.5, sources: 'x' })).toEqual(DEFAULT_INVEST_PLAN);
    expect(parseInvestPlan({ percent: 10, sources: { MXN: { kind: 'account' } } })).toEqual({
      percent: 10,
      sources: {},
    });
  });
});
