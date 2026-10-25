import { describe, expect, it } from 'vitest';
import { computeAccount } from '../engine';
import { computePortfolio } from '../portfolio';
import type { AccountEvent } from '../types';
import {
  overdrawnWithdrawals,
  validateCandidate,
  validateRemoval,
  validateTimeline,
} from '../validation';
import { account, balance, deposit, withdrawal } from './builders';

// Rule: a withdrawal registered without the balance after it cannot take out more than the
// account is known to hold right before it (last known balance + movements registered since).

const ids = (events: readonly AccountEvent[]) => overdrawnWithdrawals(events);

describe('overdrawnWithdrawals', () => {
  it('allows withdrawing up to the known balance, not more', () => {
    const start = balance('2026-01-01', 1_000);
    const all = withdrawal('2026-01-05', 1_000);
    const more = withdrawal('2026-01-05', 1_000.01);
    expect(ids([start, all])).toEqual([]);
    expect(ids([start, more])).toEqual([more.id]);
  });

  it('counts deposits and earlier withdrawals registered since the last balance', () => {
    const start = balance('2026-01-01', 0);
    const funding = deposit('2026-01-02', 500);
    const first = withdrawal('2026-01-03', 300);
    const second = withdrawal('2026-01-04', 300);
    expect(ids([start, funding, first])).toEqual([]);
    expect(ids([start, funding, first, second])).toEqual([second.id]);
  });

  it('trusts the balance the user gives after a movement', () => {
    const start = balance('2026-01-01', 100);
    // The account must have grown: 500 + 0 were there before the withdrawal.
    const known = withdrawal('2026-01-05', 500, 0);
    expect(ids([start, known])).toEqual([]);
    // From then on, the known balance is the one after the movement.
    expect(ids([start, deposit('2026-01-02', 50, 400), withdrawal('2026-01-03', 400)])).toEqual([]);
  });

  it('a new balance resets what is known', () => {
    const start = balance('2026-01-01', 100);
    const update = balance('2026-02-01', 2_000);
    expect(ids([start, update, withdrawal('2026-02-02', 2_000)])).toEqual([]);
  });

  it('is not part of the timeline rules: older data stays readable', () => {
    const legacy = [balance('2026-01-01', 0), withdrawal('2026-01-01', 1)];
    expect(validateTimeline(legacy)).toEqual([]);
    expect(computeAccount(legacy).summary?.currentBalance).toBe(-100);
  });
});

describe('validateCandidate with withdrawals', () => {
  const start = balance('2026-01-01', 1_000);

  it('rejects a withdrawal larger than the known balance', () => {
    const big = withdrawal('2026-01-10', 1_500);
    expect(validateCandidate([start], big)).toEqual([
      { code: 'WITHDRAWAL_EXCEEDS_BALANCE', eventId: big.id },
    ]);
    // With the balance after it, the same withdrawal is fine.
    expect(validateCandidate([start], withdrawal('2026-01-10', 1_500, 0))).toEqual([]);
  });

  it('rejects an edit that leaves a later withdrawal without funds', () => {
    const take = withdrawal('2026-01-10', 800);
    expect(validateCandidate([start, take], { ...start, balance: 50_000 })).toEqual([
      { code: 'WITHDRAWAL_EXCEEDS_BALANCE', eventId: take.id },
    ]);
  });

  it('does not block unrelated changes on older data that already broke the rule', () => {
    const legacy = withdrawal('2026-01-05', 2_000);
    expect(validateCandidate([start, legacy], balance('2026-02-01', 1_200))).toEqual([]);
  });
});

describe('validateRemoval', () => {
  it('rejects deleting the deposit that funds a later withdrawal', () => {
    const start = balance('2026-01-01', 0);
    const funding = deposit('2026-01-02', 500);
    const take = withdrawal('2026-01-03', 500);
    expect(validateRemoval([start, funding, take], funding.id)).toEqual([
      { code: 'WITHDRAWAL_EXCEEDS_BALANCE', eventId: take.id },
    ]);
    expect(validateRemoval([start, funding, take], take.id)).toEqual([]);
  });
});

describe('portfolio with older data that broke the rule', () => {
  it('still computes, and its gain is still the sum of the accounts', () => {
    // Found by the property tests: an account at 0 with a withdrawal of 1, next to another one.
    const a = [balance('2026-01-01', 0), withdrawal('2026-01-01', 1)];
    const b = [balance('2026-01-02', 0)];
    const [portfolio] = computePortfolio([
      { account: account('a'), events: a },
      { account: account('b'), events: b },
    ]);
    const gains = [a, b].map((events) => computeAccount(events).summary?.totalGain ?? 0);
    expect(portfolio?.computation.summary?.totalGain).toBe(gains[0]! + gains[1]!);
  });
});
