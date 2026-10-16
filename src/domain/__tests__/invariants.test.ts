import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeAccount } from '../engine';
import { computePortfolio } from '../portfolio';
import type { AccountEvent, AccountSummary } from '../types';
import { account, addDays } from './builders';

const MAX_BALANCE = 1_000_000_000; // 10 million in cents
const MAX_FLOW = 100_000_000;

type Step =
  | { kind: 'balance'; gap: number; balance: number }
  | { kind: 'deposit' | 'withdrawal'; gap: number; amount: number; after: number | null };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.record({
    kind: fc.constant('balance' as const),
    gap: fc.nat(40),
    balance: fc.integer({ min: 0, max: MAX_BALANCE }),
  }),
  fc.record({
    kind: fc.constantFrom('deposit' as const, 'withdrawal' as const),
    gap: fc.nat(40),
    amount: fc.integer({ min: 1, max: MAX_FLOW }),
    after: fc.option(fc.integer({ min: 0, max: MAX_BALANCE }), { nil: null }),
  }),
);

/** Builds a random but valid timeline: initial balance first, dates never go backwards. */
const timelineArb: fc.Arbitrary<AccountEvent[]> = fc
  .record({
    initial: fc.integer({ min: 0, max: MAX_BALANCE }),
    startOffset: fc.nat(20),
    steps: fc.array(stepArb, { maxLength: 30 }),
  })
  .map(({ initial, startOffset, steps }) => {
    let date = addDays('2026-01-01', startOffset);
    const events: AccountEvent[] = [{ id: 'i', seq: 0, date, type: 'balance', balance: initial }];
    steps.forEach((step, index) => {
      date = addDays(date, step.gap);
      const base = { id: `s${index}`, seq: index + 1, date };
      if (step.kind === 'balance') {
        events.push({ ...base, type: 'balance', balance: step.balance });
      } else {
        const after =
          step.after === null
            ? {}
            : // Keep deposits valid: the balance after must cover the deposit itself.
              { balanceAfter: step.kind === 'deposit' ? step.after + step.amount : step.after };
        events.push({ ...base, type: step.kind, amount: step.amount, ...after });
      }
    });
    return events;
  });

function summaryOf(events: AccountEvent[]): AccountSummary {
  const { summary } = computeAccount(events);
  if (!summary) throw new Error('expected a summary');
  return summary;
}

describe('engine invariants (property-based)', () => {
  it('total gain always equals current balance minus net contributed', () => {
    fc.assert(
      fc.property(timelineArb, (events) => {
        const s = summaryOf(events);
        expect(s.totalGain).toBe(s.currentBalance - s.netContributed);
        expect(s.netContributed).toBe(s.initialBalance + s.totalDeposits - s.totalWithdrawals);
      }),
    );
  });

  it('period gains add up to the total gain', () => {
    fc.assert(
      fc.property(timelineArb, (events) => {
        const { periods, summary } = computeAccount(events);
        const sum = periods.reduce((acc, p) => acc + p.gain, 0);
        expect(sum).toBe(summary?.totalGain);
        expect(periods.at(-1)?.cumulativeGain ?? 0).toBe(summary?.totalGain);
        for (const p of periods) {
          expect(p.gain).toBe(p.endBalance - p.startBalance - p.netFlow);
          expect(Number.isSafeInteger(p.gain)).toBe(true);
        }
      }),
    );
  });

  it('does not depend on the order of the input', () => {
    fc.assert(
      fc.property(timelineArb, (events) => {
        expect(computeAccount([...events].reverse())).toEqual(computeAccount(events));
      }),
    );
  });

  it('portfolio totals are the sum of its accounts', () => {
    fc.assert(
      fc.property(fc.array(timelineArb, { minLength: 1, maxLength: 4 }), (timelines) => {
        const inputs = timelines.map((events, i) => ({
          account: account(`acc${i}`),
          events: events.map((e) => ({ ...e, id: `${i}-${e.id}` })),
        }));
        const portfolio = computePortfolio(inputs)[0]?.computation.summary;
        const accounts = inputs.map((input) => summaryOf(input.events));
        const total = (key: 'totalGain' | 'netContributed' | 'currentBalance') =>
          accounts.reduce((acc, s) => acc + s[key], 0);

        expect(portfolio?.totalGain).toBe(total('totalGain'));
        expect(portfolio?.netContributed).toBe(total('netContributed'));
        expect(portfolio?.currentBalance).toBe(total('currentBalance'));
      }),
    );
  });
});
