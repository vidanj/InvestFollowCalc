import { describe, expect, it } from 'vitest';
import { previewEvent } from '../preview';
import type { AccountEvent } from '../types';
import { nextSeq, validateCandidate } from '../validation';
import { balance, cents, deposit } from './builders';

const draft = (event: AccountEvent): AccountEvent => ({ ...event, id: 'draft' });

describe('previewEvent', () => {
  const history = () => [balance('2026-10-01', 10_000)];

  it('shows the gain revealed by a balance update', () => {
    const events = history();
    const preview = previewEvent(events, draft(balance('2026-10-12', 10_001)));

    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.closedPeriod).toMatchObject({ days: 11, gain: cents(1) });
    expect(preview.summary.totalGain).toBe(cents(1));
  });

  it('closes the gain right before a movement with a known balance', () => {
    const events = [...history(), balance('2026-10-12', 10_001)];
    const preview = previewEvent(events, draft(deposit('2026-10-15', 500, 10_510)));

    expect(preview.ok && preview.closedPeriod).toMatchObject({ days: 3, gain: cents(9) });
    expect(preview.ok && preview.summary.netContributed).toBe(cents(10_500));
  });

  it('closes no period for a movement without a known balance', () => {
    const preview = previewEvent(history(), draft(deposit('2026-10-15', 500)));
    expect(preview.ok && preview.closedPeriod).toBeNull();
    expect(preview.ok && preview.summary.hasPendingFlows).toBe(true);
  });

  it('previews an edit by replacing the event with the same id', () => {
    const update = balance('2026-10-12', 10_001);
    const events = [...history(), update];
    const preview = previewEvent(events, { ...update, balance: cents(10_100) });

    expect(preview.ok && preview.summary.totalGain).toBe(cents(100));
  });

  it('returns the validation issues of an invalid candidate', () => {
    const preview = previewEvent(history(), draft(balance('2026-09-01', 1)));
    expect(preview).toEqual({
      ok: false,
      issues: [{ code: 'BEFORE_INITIAL_BALANCE', eventId: 'draft' }],
    });
  });
});

describe('validateCandidate', () => {
  it('accepts the first event of a new account', () => {
    expect(validateCandidate([], balance('2026-01-01', 1))).toEqual([]);
    expect(validateCandidate([], deposit('2026-01-01', 1)).map((i) => i.code)).toEqual([
      'FIRST_EVENT_NOT_BALANCE',
    ]);
  });

  it('keeps other timeline issues next to structural ones', () => {
    const initial = balance('2026-01-10', 1_000);
    const issues = validateCandidate(
      [initial],
      draft({ ...deposit('2026-01-01', 500, 300), amount: 0 }),
    );
    expect(issues.map((i) => i.code)).toEqual(['BEFORE_INITIAL_BALANCE', 'INVALID_AMOUNT']);
  });
});

describe('nextSeq', () => {
  it('places a new event after every existing one', () => {
    expect(nextSeq([])).toBe(1);
    const events = [
      { ...balance('2026-01-01', 1), seq: 7 },
      { ...balance('2026-01-02', 1), seq: 3 },
    ];
    expect(nextSeq(events)).toBe(8);
  });
});
