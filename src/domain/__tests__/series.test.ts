import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { addMonths } from '../dates';
import { computeAccount } from '../engine';
import { buildPortfolioTimeline } from '../portfolio';
import { buildSeries, isInRange, rangeStart, rankPeriods } from '../series';
import type { AccountEvent, Period } from '../types';
import { DomainValidationError } from '../validation';
import { addDays, balance, cents, deposit, withdrawal } from './builders';

describe('buildSeries', () => {
  it('tracks balance, contributed capital and gain for the user example', () => {
    const series = buildSeries([
      balance('2026-10-01', 10_000),
      balance('2026-10-12', 10_001),
      deposit('2026-10-15', 500, 10_501),
      balance('2026-11-02', 10_550),
    ]);

    expect(series.map((p) => [p.date, p.balance, p.contributed, p.gain])).toEqual([
      ['2026-10-01', cents(10_000), cents(10_000), 0],
      ['2026-10-12', cents(10_001), cents(10_000), cents(1)],
      ['2026-10-15', cents(10_501), cents(10_500), cents(1)],
      ['2026-11-02', cents(10_550), cents(10_500), cents(50)],
    ]);
  });

  it('estimates the balance after movements without a known balance', () => {
    const series = buildSeries([
      balance('2026-01-01', 1_000),
      deposit('2026-01-05', 200),
      withdrawal('2026-01-07', 50),
      balance('2026-01-10', 1_160),
    ]);

    expect(series.map((p) => [p.balance, p.estimated])).toEqual([
      [cents(1_000), false],
      [cents(1_200), true],
      [cents(1_150), true],
      [cents(1_160), false],
    ]);
    expect(series.at(-1)?.gain).toBe(cents(10));
  });

  it('keeps one point per date: the state after its last event', () => {
    const series = buildSeries([
      balance('2026-01-01', 1_000),
      deposit('2026-01-01', 500, 1_500),
      balance('2026-01-02', 1_501),
    ]);
    expect(series.map((p) => [p.date, p.balance, p.contributed])).toEqual([
      ['2026-01-01', cents(1_500), cents(1_500)],
      ['2026-01-02', cents(1_501), cents(1_500)],
    ]);
  });

  it('works on a portfolio timeline and rejects invalid ones', () => {
    const timeline = buildPortfolioTimeline([
      [balance('2026-01-01', 1_000), balance('2026-01-10', 1_010)],
      [balance('2026-01-05', 500)],
    ]);
    expect(buildSeries(timeline).at(-1)).toMatchObject({
      balance: cents(1_510),
      contributed: cents(1_500),
      gain: cents(10),
    });
    expect(buildSeries([])).toEqual([]);
    expect(() => buildSeries([deposit('2026-01-01', 1)])).toThrow(DomainValidationError);
  });

  it('always ends at the same gain as the engine', () => {
    const arbitraryEvents = fc
      .array(
        fc.record({
          gap: fc.nat(30),
          kind: fc.constantFrom('balance', 'deposit', 'withdrawal'),
          value: fc.integer({ min: 1, max: 1_000_000 }),
        }),
        { maxLength: 20 },
      )
      .map((steps) => {
        let date = '2026-01-01';
        const events: AccountEvent[] = [balance(date, 1_000)];
        for (const step of steps) {
          date = addDays(date, step.gap);
          const units = step.value / 100;
          if (step.kind === 'balance') events.push(balance(date, units));
          else if (step.kind === 'deposit') events.push(deposit(date, units));
          else events.push(withdrawal(date, units));
        }
        return events;
      });

    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        const last = buildSeries(events).at(-1);
        expect(last?.gain).toBe(computeAccount(events).summary?.totalGain);
      }),
    );
  });
});

describe('rankPeriods', () => {
  const period = (returnRate: number | null, gain = 0): Period => ({
    startDate: '2026-01-01',
    endDate: '2026-01-02',
    days: 1,
    startBalance: 0,
    endBalance: 0,
    netFlow: 0,
    gain,
    returnRate,
    cumulativeGain: 0,
    endEventId: `p${String(returnRate)}-${gain}`,
  });

  it('ranks by return rate, not by amount', () => {
    const bigAmountLowRate = period(0.001, 10_000);
    const smallAmountHighRate = period(0.05, 100);
    const loss = period(-0.02, -500);
    const ranked = rankPeriods([bigAmountLowRate, smallAmountHighRate, loss, period(null, 1)]);

    expect(ranked?.best).toBe(smallAmountHighRate);
    expect(ranked?.worst).toBe(loss);
  });

  it('needs at least two comparable, different periods', () => {
    expect(rankPeriods([])).toBeNull();
    expect(rankPeriods([period(0.01), period(null)])).toBeNull();
    expect(rankPeriods([period(0.01), period(0.01)])).toBeNull();
  });
});

describe('ranges', () => {
  it('counts back whole months from today', () => {
    expect(rangeStart('1M', '2026-10-16')).toBe('2026-09-16');
    expect(rangeStart('3M', '2026-10-16')).toBe('2026-07-16');
    expect(rangeStart('6M', '2026-10-16')).toBe('2026-04-16');
    expect(rangeStart('1Y', '2026-10-16')).toBe('2025-10-16');
    expect(rangeStart('ALL', '2026-10-16')).toBeNull();
  });

  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2028-03-31', -1)).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(() => addMonths('nope', 1)).toThrow(RangeError);
  });

  it('includes dates on or after the start', () => {
    expect(isInRange('2026-09-16', '2026-09-16')).toBe(true);
    expect(isInRange('2026-09-15', '2026-09-16')).toBe(false);
    expect(isInRange('1999-01-01', null)).toBe(true);
  });
});
