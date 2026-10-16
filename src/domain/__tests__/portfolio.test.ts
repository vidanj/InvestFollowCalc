import { describe, expect, it } from 'vitest';
import { computeAccount } from '../engine';
import { computePortfolio, type PortfolioInput } from '../portfolio';
import { DomainValidationError } from '../validation';
import { account, balance, cents, deposit, withdrawal } from './builders';

function only(inputs: PortfolioInput[]) {
  const result = computePortfolio(inputs);
  expect(result).toHaveLength(1);
  const [portfolio] = result;
  if (!portfolio?.computation.summary) throw new Error('expected one portfolio with a summary');
  return { ...portfolio, summary: portfolio.computation.summary };
}

describe('computePortfolio', () => {
  it('returns nothing without accounts or events', () => {
    expect(computePortfolio([])).toEqual([]);
    expect(computePortfolio([{ account: account('empty'), events: [] }])).toEqual([]);
  });

  it('keeps each currency separate', () => {
    const result = computePortfolio([
      { account: account('mx', 'MXN'), events: [balance('2026-01-01', 1_000)] },
      { account: account('us', 'USD'), events: [balance('2026-01-01', 50)] },
    ]);
    expect(
      result.map((p) => [p.currency, p.accountIds, p.computation.summary?.currentBalance]),
    ).toEqual([
      ['USD', ['us'], cents(50)],
      ['MXN', ['mx'], cents(1_000)],
    ]);
  });

  it('matches the account itself when there is a single account', () => {
    const events = [
      balance('2026-10-01', 10_000),
      balance('2026-10-12', 10_001),
      deposit('2026-10-15', 500, 10_501),
      balance('2026-11-02', 10_550),
    ];
    const portfolio = only([{ account: account('a'), events }]).summary;
    const single = computeAccount(events).summary;

    expect(portfolio.totalGain).toBe(single?.totalGain);
    expect(portfolio.netContributed).toBe(single?.netContributed);
    expect(portfolio.currentBalance).toBe(single?.currentBalance);
    expect(portfolio.twr).toBeCloseTo(single?.twr ?? Number.NaN, 12);
  });

  it('adds up gains of accounts that start on the same day', () => {
    const { summary, computation } = only([
      {
        account: account('a'),
        events: [balance('2026-01-01', 10_000), balance('2026-01-11', 10_100)],
      },
      {
        account: account('b'),
        events: [balance('2026-01-01', 5_000), balance('2026-01-21', 4_950)],
      },
    ]);

    expect(computation.periods.map((p) => [p.startDate, p.endDate, p.gain])).toEqual([
      ['2026-01-01', '2026-01-11', cents(100)],
      ['2026-01-11', '2026-01-21', cents(-50)],
    ]);
    expect(summary.initialBalance).toBe(cents(15_000));
    expect(summary.totalGain).toBe(cents(50));
    expect(summary.currentBalance).toBe(cents(15_050));
  });

  it('treats an account opened later as fresh capital, not as gain', () => {
    const { summary, computation } = only([
      {
        account: account('a'),
        events: [
          balance('2026-01-01', 10_000),
          balance('2026-01-11', 10_100),
          balance('2026-01-21', 10_200),
        ],
      },
      { account: account('late'), events: [balance('2026-01-16', 5_000)] },
    ]);

    expect(computation.periods.map((p) => [p.endDate, p.netFlow, p.gain])).toEqual([
      ['2026-01-11', 0, cents(100)],
      ['2026-01-16', cents(5_000), 0],
      ['2026-01-21', 0, cents(100)],
    ]);
    expect(summary.netContributed).toBe(cents(15_000));
    expect(summary.totalGain).toBe(cents(200));
    expect(summary.currentBalance).toBe(cents(15_200));
  });

  it('carries forward flows of accounts that were not updated', () => {
    const { summary } = only([
      {
        account: account('a'),
        events: [balance('2026-01-01', 1_000), deposit('2026-01-05', 200)],
      },
      {
        account: account('b'),
        events: [
          balance('2026-01-01', 1_000),
          withdrawal('2026-01-03', 100, 905),
          balance('2026-01-10', 910),
        ],
      },
    ]);

    expect(summary.totalGain).toBe(cents(10)); // b: +5 before the withdrawal, +5 after
    expect(summary.netContributed).toBe(cents(2_100));
    expect(summary.currentBalance).toBe(cents(2_110));
    expect(summary.hasPendingFlows).toBe(false);
  });

  it('starts from a zero-balance account and ignores empty initial deposits', () => {
    const { summary } = only([
      { account: account('a'), events: [balance('2026-01-01', 1_000)] },
      {
        account: account('zero'),
        events: [balance('2026-01-05', 0), deposit('2026-01-06', 100, 100)],
      },
    ]);
    expect(summary.netContributed).toBe(cents(1_100));
    expect(summary.totalGain).toBe(0);
  });

  it('rejects an invalid account timeline', () => {
    expect(() =>
      computePortfolio([{ account: account('bad'), events: [deposit('2026-01-01', 1)] }]),
    ).toThrow(DomainValidationError);
  });
});
