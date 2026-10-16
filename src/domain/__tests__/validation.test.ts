import { describe, expect, it } from 'vitest';
import type { AccountEvent } from '../types';
import { DomainValidationError, sortEvents, validateTimeline } from '../validation';
import { balance, deposit, withdrawal } from './builders';

const codes = (events: AccountEvent[]) => validateTimeline(events).map((i) => i.code);

describe('validateTimeline', () => {
  it('accepts an empty or well-formed timeline', () => {
    expect(validateTimeline([])).toEqual([]);
    expect(
      validateTimeline([
        balance('2026-01-01', 1_000),
        deposit('2026-01-02', 100, 1_100),
        withdrawal('2026-01-03', 1_100, 0),
        balance('2026-01-04', 0),
      ]),
    ).toEqual([]);
  });

  it('requires the earliest event to be the initial balance', () => {
    const early = deposit('2026-01-01', 100);
    expect(validateTimeline([balance('2026-01-05', 1_000), early])).toEqual([
      { code: 'FIRST_EVENT_NOT_BALANCE', eventId: early.id },
    ]);
  });

  it('rejects invalid dates and sequence numbers', () => {
    const start = balance('2026-01-01', 1_000);
    expect(codes([start, balance('2026-02-30', 1)])).toEqual(['INVALID_DATE']);
    expect(codes([start, { ...balance('2026-01-02', 1), seq: Number.NaN }])).toEqual([
      'INVALID_SEQ',
    ]);
  });

  it('rejects negative or fractional balances', () => {
    expect(codes([{ ...balance('2026-01-01', 0), balance: -1 }])).toEqual(['INVALID_BALANCE']);
    expect(codes([{ ...balance('2026-01-01', 0), balance: 10.5 }])).toEqual(['INVALID_BALANCE']);
  });

  it('rejects non-positive or fractional flow amounts', () => {
    const start = balance('2026-01-01', 1_000);
    expect(codes([start, { ...deposit('2026-01-02', 1), amount: 0 }])).toEqual(['INVALID_AMOUNT']);
    expect(codes([start, { ...withdrawal('2026-01-02', 1), amount: -5 }])).toEqual([
      'INVALID_AMOUNT',
    ]);
    expect(codes([start, { ...deposit('2026-01-02', 1), amount: 1.5 }])).toEqual([
      'INVALID_AMOUNT',
    ]);
  });

  it('checks the balance after a movement', () => {
    const start = balance('2026-01-01', 1_000);
    expect(codes([start, { ...deposit('2026-01-02', 1, 1), balanceAfter: -1 }])).toEqual([
      'INVALID_BALANCE',
    ]);
    // Balance after a deposit of 500 cannot be 300: the balance before would be negative.
    expect(codes([start, deposit('2026-01-02', 500, 300)])).toEqual(['BALANCE_AFTER_TOO_LOW']);
  });
});

describe('sortEvents', () => {
  it('sorts by date, then capture order, then id, without mutating the input', () => {
    const a = balance('2026-01-02', 1);
    const b = balance('2026-01-01', 1);
    const c = { ...balance('2026-01-02', 1), seq: a.seq, id: 'a-same-seq' };
    const input = [a, b, c];

    // b has the earliest date; a and c share date and seq, so the id decides ("a-…" < "e…").
    expect(sortEvents(input).map((e) => e.id)).toEqual([b.id, c.id, a.id]);
    expect(input).toEqual([a, b, c]);
  });
});

describe('DomainValidationError', () => {
  it('exposes the issues and names them in the message', () => {
    const error = new DomainValidationError([{ code: 'INVALID_DATE', eventId: 'x1' }]);
    expect(error.issues).toEqual([{ code: 'INVALID_DATE', eventId: 'x1' }]);
    expect(error.message).toContain('INVALID_DATE@x1');
    expect(error.name).toBe('DomainValidationError');
  });
});
