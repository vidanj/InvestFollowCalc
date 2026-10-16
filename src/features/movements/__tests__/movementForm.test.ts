import { describe, expect, it } from 'vitest';
import { balance, deposit, withdrawal } from '../../../domain/__tests__/builders';
import { strings } from '../../../i18n/es-MX';
import {
  DRAFT_EVENT_ID,
  emptyMovementValues,
  parseMovementForm,
  toCandidate,
  valuesFromEvent,
  type MovementFormValues,
} from '../movementForm';

const TODAY = '2026-10-16';
const values = (patch: Partial<MovementFormValues>): MovementFormValues => ({
  ...emptyMovementValues(TODAY),
  ...patch,
});

describe('parseMovementForm', () => {
  it('builds a balance update', () => {
    expect(parseMovementForm(values({ amount: '10,001' }), TODAY)).toEqual({
      ok: true,
      draft: { type: 'balance', date: TODAY, balance: 1_000_100 },
    });
  });

  it('builds deposits and withdrawals, with or without the balance after', () => {
    expect(
      parseMovementForm(values({ type: 'deposit', amount: '500', balanceAfter: '10501' }), TODAY),
    ).toEqual({
      ok: true,
      draft: { type: 'deposit', date: TODAY, amount: 50_000, balanceAfter: 1_050_100 },
    });
    expect(parseMovementForm(values({ type: 'withdrawal', amount: '200' }), TODAY)).toEqual({
      ok: true,
      draft: { type: 'withdrawal', date: TODAY, amount: 20_000 },
    });
  });

  it('ignores the balance-after field for balance updates', () => {
    const parsed = parseMovementForm(values({ amount: '1', balanceAfter: 'junk' }), TODAY);
    expect(parsed.ok).toBe(true);
  });

  it('reports field errors', () => {
    expect(parseMovementForm(values({ date: '', amount: '' }), TODAY)).toEqual({
      ok: false,
      errors: { date: strings.errors.required, amount: strings.errors.required },
    });
    expect(
      parseMovementForm(
        values({ type: 'deposit', date: '2026-10-17', amount: 'abc', balanceAfter: '1.234' }),
        TODAY,
      ),
    ).toEqual({
      ok: false,
      errors: {
        date: strings.errors.futureDate,
        amount: strings.errors.invalidAmount,
        balanceAfter: strings.errors.invalidAmount,
      },
    });
    expect(parseMovementForm(values({ date: '2026-02-30', amount: '1' }), TODAY)).toEqual({
      ok: false,
      errors: { date: strings.errors.invalidDate },
    });
  });
});

describe('valuesFromEvent', () => {
  it('round-trips stored events into editable text', () => {
    expect(valuesFromEvent(balance('2026-10-01', 10_000.5))).toMatchObject({
      type: 'balance',
      amount: '10,000.50',
      balanceAfter: '',
    });
    expect(valuesFromEvent(deposit('2026-10-01', 500, 10_501))).toMatchObject({
      type: 'deposit',
      amount: '500.00',
      balanceAfter: '10,501.00',
    });
    expect(valuesFromEvent(withdrawal('2026-10-01', 1))).toMatchObject({ balanceAfter: '' });
  });
});

describe('toCandidate', () => {
  const events = [balance('2026-10-01', 1), balance('2026-10-02', 2)];
  const draft = { type: 'balance' as const, date: '2026-10-03', balance: 3 };

  it('gives new events a draft id and the next capture order', () => {
    const maxSeq = Math.max(...events.map((e) => e.seq));
    expect(toCandidate(events, draft)).toMatchObject({ id: DRAFT_EVENT_ID, seq: maxSeq + 1 });
  });

  it('keeps id and order when editing', () => {
    const [, editing] = events;
    expect(toCandidate(events, draft, editing)).toMatchObject({
      id: editing?.id,
      seq: editing?.seq,
      balance: 3,
    });
  });
});
