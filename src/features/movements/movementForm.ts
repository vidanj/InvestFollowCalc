import { compareIsoDates, isIsoDate } from '../../domain/dates';
import { formatAmountInput, parseAmountToCents } from '../../domain/money';
import type { AccountEvent, EventDraft, IsoDate } from '../../domain/types';
import { nextSeq } from '../../domain/validation';
import { strings } from '../../i18n/es-MX';

export type MovementType = AccountEvent['type'];

export interface MovementFormValues {
  type: MovementType;
  date: string;
  /** Balance for "Actualizar saldo", amount for deposits/withdrawals. */
  amount: string;
  /** Only for deposits/withdrawals; empty when unknown. */
  balanceAfter: string;
}

export interface MovementFormErrors {
  date?: string;
  amount?: string;
  balanceAfter?: string;
}

export type ParsedMovement =
  { ok: true; draft: EventDraft } | { ok: false; errors: MovementFormErrors };

/** Id given to a not-yet-saved event while previewing it. */
export const DRAFT_EVENT_ID = 'draft';

export function emptyMovementValues(today: IsoDate): MovementFormValues {
  return { type: 'balance', date: today, amount: '', balanceAfter: '' };
}

export function valuesFromEvent(event: AccountEvent): MovementFormValues {
  if (event.type === 'balance') {
    return {
      type: 'balance',
      date: event.date,
      amount: formatAmountInput(event.balance),
      balanceAfter: '',
    };
  }
  return {
    type: event.type,
    date: event.date,
    amount: formatAmountInput(event.amount),
    balanceAfter: event.balanceAfter === undefined ? '' : formatAmountInput(event.balanceAfter),
  };
}

/** Turns form text into an event draft, or field errors. Dates after `today` are rejected. */
export function parseMovementForm(values: MovementFormValues, today: IsoDate): ParsedMovement {
  const errors: MovementFormErrors = {};

  if (values.date.trim() === '') errors.date = strings.errors.required;
  else if (!isIsoDate(values.date)) errors.date = strings.errors.invalidDate;
  else if (compareIsoDates(values.date, today) > 0) errors.date = strings.errors.futureDate;

  const amount = parseAmountToCents(values.amount);
  if (values.amount.trim() === '') errors.amount = strings.errors.required;
  else if (amount === null) errors.amount = strings.errors.invalidAmount;

  let balanceAfter: number | undefined;
  if (values.type !== 'balance' && values.balanceAfter.trim() !== '') {
    const parsed = parseAmountToCents(values.balanceAfter);
    if (parsed === null) errors.balanceAfter = strings.errors.invalidAmount;
    else balanceAfter = parsed;
  }

  if (errors.date || errors.amount || errors.balanceAfter || amount === null) {
    return { ok: false, errors };
  }
  if (values.type === 'balance') {
    return { ok: true, draft: { type: 'balance', date: values.date, balance: amount } };
  }
  return {
    ok: true,
    draft: {
      type: values.type,
      date: values.date,
      amount,
      ...(balanceAfter === undefined ? {} : { balanceAfter }),
    },
  };
}

/** The event as it would be stored, for previewing: keeps id/order when editing. */
export function toCandidate(
  events: readonly AccountEvent[],
  draft: EventDraft,
  editing?: AccountEvent,
): AccountEvent {
  if (editing) return { ...draft, id: editing.id, seq: editing.seq };
  return { ...draft, id: DRAFT_EVENT_ID, seq: nextSeq(events) };
}
