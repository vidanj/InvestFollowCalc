import { describe, expect, it } from 'vitest';
import { computeAccount } from '../engine';
import type { AccountEvent, AccountSummary } from '../types';
import { DomainValidationError } from '../validation';
import { balance, cents, deposit, withdrawal } from './builders';

function summaryOf(events: AccountEvent[]): AccountSummary {
  const { summary } = computeAccount(events);
  if (!summary) throw new Error('expected a summary');
  return summary;
}

const periodShape = (events: AccountEvent[]) =>
  computeAccount(events).periods.map((p) => ({
    from: p.startDate,
    to: p.endDate,
    days: p.days,
    netFlow: p.netFlow,
    gain: p.gain,
  }));

describe('computeAccount — user example', () => {
  // 10,000 → 10,001 (+1) → deposit 500 → 10,501 → 10,550 (+49): 50 generated in total.
  const withKnownBalance = (): AccountEvent[] => [
    balance('2026-10-01', 10_000),
    balance('2026-10-12', 10_001),
    deposit('2026-10-15', 500, 10_501),
    balance('2026-11-02', 10_550),
  ];

  it('separates the generated money from the extra deposit', () => {
    expect(periodShape(withKnownBalance())).toEqual([
      { from: '2026-10-01', to: '2026-10-12', days: 11, netFlow: 0, gain: cents(1) },
      { from: '2026-10-12', to: '2026-10-15', days: 3, netFlow: 0, gain: 0 },
      { from: '2026-10-15', to: '2026-11-02', days: 18, netFlow: 0, gain: cents(49) },
    ]);
  });

  it('summarizes 50 generated over 10,500 contributed', () => {
    const s = summaryOf(withKnownBalance());
    const twr = (1 + 100 / 1_000_000) * (1 + 4_900 / 1_050_100) - 1;

    expect(s.initialBalance).toBe(cents(10_000));
    expect(s.totalDeposits).toBe(cents(500));
    expect(s.totalWithdrawals).toBe(0);
    expect(s.netContributed).toBe(cents(10_500));
    expect(s.currentBalance).toBe(cents(10_550));
    expect(s.totalGain).toBe(cents(50));
    expect(s.hasPendingFlows).toBe(false);
    expect(s.simpleReturn).toBeCloseTo(50 / 10_500, 12);
    expect(s.twr).toBeCloseTo(twr, 12);
    expect(s.elapsedDays).toBe(32);
    expect(s.annualizedTwr).toBeCloseTo(Math.pow(1 + twr, 365 / 32) - 1, 12);
    expect(s.isShortPeriod).toBe(false);
    expect(s.avgDailyGain).toBe(156); // 5,000 cents / 32 days
    expect(s.avgMonthlyGain).toBe(4_753); // 156.25 cents/day × 30.4167 days
    expect(s.twrExcludedPeriods).toBe(0);
  });

  it('accumulates the gain period by period', () => {
    const { periods } = computeAccount(withKnownBalance());
    expect(periods.map((p) => p.cumulativeGain)).toEqual([cents(1), cents(1), cents(50)]);
    expect(periods.map((p) => p.returnRate)).toEqual([100 / 1_000_000, 0, 4_900 / 1_050_100]);
  });

  it('gives the same totals when the balance after the deposit is unknown', () => {
    const events = [
      balance('2026-10-01', 10_000),
      balance('2026-10-12', 10_001),
      deposit('2026-10-15', 500),
      balance('2026-11-02', 10_550),
    ];

    expect(periodShape(events)).toEqual([
      { from: '2026-10-01', to: '2026-10-12', days: 11, netFlow: 0, gain: cents(1) },
      { from: '2026-10-12', to: '2026-11-02', days: 21, netFlow: cents(500), gain: cents(49) },
    ]);
    // Modified Dietz: the deposit was invested 18 of the 21 days.
    expect(computeAccount(events).periods[1]?.returnRate).toBeCloseTo(
      4_900 / (1_000_100 + (18 / 21) * 50_000),
      12,
    );
    const s = summaryOf(events);
    expect(s.totalGain).toBe(cents(50));
    expect(s.netContributed).toBe(cents(10_500));
  });
});

describe('computeAccount — contributions and withdrawals', () => {
  it('never counts a deposit as gain', () => {
    const s = summaryOf([
      balance('2026-01-01', 1_000),
      deposit('2026-01-10', 500, 1_500),
      balance('2026-01-20', 1_500),
    ]);
    expect(s.totalGain).toBe(0);
    expect(s.netContributed).toBe(cents(1_500));
  });

  it('never counts a withdrawal as a loss', () => {
    const known = summaryOf([
      balance('2026-01-01', 1_000),
      balance('2026-01-11', 1_010),
      withdrawal('2026-01-15', 200, 810),
      balance('2026-01-25', 820),
    ]);
    expect(known.totalGain).toBe(cents(20));
    expect(known.totalWithdrawals).toBe(cents(200));
    expect(known.netContributed).toBe(cents(800));
    expect(known.currentBalance).toBe(cents(820));

    const unknown = summaryOf([
      balance('2026-01-01', 1_000),
      balance('2026-01-11', 1_010),
      withdrawal('2026-01-15', 200),
      balance('2026-01-25', 820),
    ]);
    expect(unknown.totalGain).toBe(cents(20));
  });

  it('reports losses as negative gains', () => {
    const { periods, summary } = computeAccount([
      balance('2026-01-01', 1_000),
      balance('2026-02-01', 950),
    ]);
    expect(periods[0]?.gain).toBe(cents(-50));
    expect(periods[0]?.returnRate).toBeCloseTo(-0.05, 12);
    expect(summary?.simpleReturn).toBeCloseTo(-0.05, 12);
  });

  it('marks flows after the last known balance as pending', () => {
    const s = summaryOf([
      balance('2026-01-01', 1_000),
      balance('2026-01-10', 1_010),
      deposit('2026-01-15', 500),
    ]);
    expect(s.hasPendingFlows).toBe(true);
    expect(s.pendingFlow).toBe(cents(500));
    expect(s.currentBalance).toBe(cents(1_510));
    expect(s.netContributed).toBe(cents(1_500));
    expect(s.totalGain).toBe(cents(10));
    expect(s.lastValuationDate).toBe('2026-01-10');
  });
});

describe('computeAccount — ordering', () => {
  it('orders same-day events by capture order (seq), not by array position', () => {
    const start = balance('2026-01-01', 1_000);
    const flowFirst = deposit('2026-01-05', 100);
    const thenBalance = balance('2026-01-05', 1_105);

    const s = summaryOf([thenBalance, flowFirst, start]);
    expect(s.totalGain).toBe(cents(5));
    expect(s.hasPendingFlows).toBe(false);
  });

  it('does not depend on the order of the input array', () => {
    const events = [
      balance('2026-03-01', 2_000),
      deposit('2026-03-05', 300),
      balance('2026-03-20', 2_350),
      withdrawal('2026-04-01', 100, 2_260),
      balance('2026-04-15', 2_300),
    ];
    expect(computeAccount([...events].reverse())).toEqual(computeAccount(events));
  });

  it('recomputes consistently after deleting an intermediate balance', () => {
    const events = [
      balance('2026-10-01', 10_000),
      balance('2026-10-12', 10_001),
      deposit('2026-10-15', 500, 10_501),
      balance('2026-11-02', 10_550),
    ];
    const withoutSecond = events.filter((_, i) => i !== 1);

    expect(periodShape(withoutSecond)).toEqual([
      { from: '2026-10-01', to: '2026-10-15', days: 14, netFlow: 0, gain: cents(1) },
      { from: '2026-10-15', to: '2026-11-02', days: 18, netFlow: 0, gain: cents(49) },
    ]);
    expect(summaryOf(withoutSecond).totalGain).toBe(cents(50));
  });
});

describe('computeAccount — Modified Dietz weights', () => {
  it('weighs a flow on the start date as invested the whole period', () => {
    const { periods } = computeAccount([
      balance('2026-01-01', 1_000),
      deposit('2026-01-01', 1_000),
      balance('2026-01-11', 2_100),
    ]);
    expect(periods[0]?.returnRate).toBeCloseTo(100 / 2_000, 12);
  });

  it('weighs a flow on the end date as not invested', () => {
    const { periods } = computeAccount([
      balance('2026-01-01', 1_000),
      deposit('2026-01-11', 1_000),
      balance('2026-01-11', 2_100),
    ]);
    expect(periods[0]?.returnRate).toBeCloseTo(100 / 1_000, 12);
  });

  it('weighs flows in a same-day period at one half', () => {
    const { periods } = computeAccount([
      balance('2026-01-01', 1_000),
      deposit('2026-01-01', 1_000),
      balance('2026-01-01', 2_100),
    ]);
    expect(periods[0]?.days).toBe(0);
    expect(periods[0]?.returnRate).toBeCloseTo(100 / 1_500, 12);
  });
});

describe('computeAccount — edge cases', () => {
  it('returns nothing for an account without events', () => {
    expect(computeAccount([])).toEqual({ periods: [], summary: null });
  });

  it('handles an account with only its initial balance', () => {
    const { periods, summary } = computeAccount([balance('2026-01-01', 1_000)]);
    expect(periods).toEqual([]);
    expect(summary).toMatchObject({
      currentBalance: cents(1_000),
      netContributed: cents(1_000),
      totalGain: 0,
      simpleReturn: null,
      twr: null,
      annualizedTwr: null,
      elapsedDays: 0,
      isShortPeriod: true,
      avgDailyGain: null,
      avgMonthlyGain: null,
    });
  });

  it('omits same-day stretches where nothing was generated', () => {
    const events = [balance('2026-01-01', 1_000), deposit('2026-01-01', 500, 1_500)];
    expect(computeAccount(events).periods).toEqual([]);

    events.push(balance('2026-01-11', 1_510));
    expect(periodShape(events)).toEqual([
      { from: '2026-01-01', to: '2026-01-11', days: 10, netFlow: 0, gain: cents(10) },
    ]);
  });

  it('keeps same-day periods that did generate money', () => {
    const { periods, summary } = computeAccount([
      balance('2026-01-01', 1_000),
      balance('2026-01-01', 1_002),
    ]);
    expect(periods).toHaveLength(1);
    expect(periods[0]?.returnRate).toBeCloseTo(0.002, 12);
    expect(summary?.annualizedTwr).toBeNull();
    expect(summary?.avgDailyGain).toBeNull();
  });

  it('excludes periods without an invested base from the TWR', () => {
    const s = summaryOf([balance('2026-01-01', 0), balance('2026-01-05', 100)]);
    expect(s.totalGain).toBe(cents(100));
    expect(s.twr).toBeNull();
    expect(s.twrExcludedPeriods).toBe(1);
    expect(s.simpleReturn).toBeNull();
  });

  it('starts measuring once money enters an account opened at zero', () => {
    const s = summaryOf([
      balance('2026-01-01', 0),
      deposit('2026-01-01', 1_000, 1_000),
      balance('2026-01-11', 1_010),
    ]);
    expect(s.twr).toBeCloseTo(0.01, 12);
    expect(s.simpleReturn).toBeCloseTo(0.01, 12);
  });

  it('flags short histories and skips annualizing a total loss', () => {
    const short = summaryOf([balance('2026-01-01', 1_000), balance('2026-01-08', 1_001)]);
    expect(short.isShortPeriod).toBe(true);
    expect(short.annualizedTwr).not.toBeNull();

    const wipedOut = summaryOf([balance('2026-01-01', 1_000), balance('2026-03-01', 0)]);
    expect(wipedOut.twr).toBeCloseTo(-1, 12);
    expect(wipedOut.annualizedTwr).toBeNull();
  });

  it('rejects a timeline that does not start with a balance', () => {
    expect(() => computeAccount([deposit('2026-01-01', 100), balance('2026-01-02', 100)])).toThrow(
      DomainValidationError,
    );
  });
});
