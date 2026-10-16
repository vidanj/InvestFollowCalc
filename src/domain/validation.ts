import { compareIsoDates, isIsoDate } from './dates';
import { isValidCents } from './money';
import type { AccountEvent } from './types';

export type ValidationIssueCode =
  | 'FIRST_EVENT_NOT_BALANCE'
  | 'INVALID_DATE'
  | 'INVALID_SEQ'
  | 'INVALID_BALANCE'
  | 'INVALID_AMOUNT'
  | 'BALANCE_AFTER_TOO_LOW';

export interface ValidationIssue {
  code: ValidationIssueCode;
  eventId: string;
}

export class DomainValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(`Invalid account timeline: ${issues.map((i) => `${i.code}@${i.eventId}`).join(', ')}`);
    this.name = 'DomainValidationError';
    this.issues = issues;
  }
}

/** Deterministic timeline order: date, then capture order, then id. */
export function sortEvents(events: readonly AccountEvent[]): AccountEvent[] {
  return [...events].sort(
    (a, b) =>
      compareIsoDates(a.date, b.date) || a.seq - b.seq || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

function isNonNegativeCents(value: number): boolean {
  return isValidCents(value) && value >= 0;
}

/**
 * Checks a whole account timeline. Messages are not produced here: the UI maps each issue code
 * to a text in `src/i18n`.
 */
export function validateTimeline(events: readonly AccountEvent[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sorted = sortEvents(events);

  const first = sorted[0];
  if (first && first.type !== 'balance') {
    issues.push({ code: 'FIRST_EVENT_NOT_BALANCE', eventId: first.id });
  }

  for (const event of sorted) {
    if (!isIsoDate(event.date)) issues.push({ code: 'INVALID_DATE', eventId: event.id });
    if (!Number.isFinite(event.seq)) issues.push({ code: 'INVALID_SEQ', eventId: event.id });

    if (event.type === 'balance') {
      if (!isNonNegativeCents(event.balance)) {
        issues.push({ code: 'INVALID_BALANCE', eventId: event.id });
      }
      continue;
    }

    if (!isValidCents(event.amount) || event.amount <= 0) {
      issues.push({ code: 'INVALID_AMOUNT', eventId: event.id });
    }
    if (event.balanceAfter !== undefined) {
      if (!isNonNegativeCents(event.balanceAfter)) {
        issues.push({ code: 'INVALID_BALANCE', eventId: event.id });
      } else if (event.type === 'deposit' && event.balanceAfter < event.amount) {
        // The balance right before the deposit would be negative.
        issues.push({ code: 'BALANCE_AFTER_TOO_LOW', eventId: event.id });
      }
    }
  }

  return issues;
}
